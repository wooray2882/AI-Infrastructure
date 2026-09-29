# AI Infrastructure — Corelink System

Agent-level monitoring and healing infrastructure for the Corelink agent org.
Runs alongside the ZeroDown AWS/Terraform/EKS stack.

---

## First-time setup — Bootstrap

Before running any environment, create the dedicated S3 state bucket and DynamoDB lock table:

```bash
cd environments/bootstrap
terraform init
terraform apply -var="state_bucket_name=corelink-ai-tf-state-<your-account-id>"
```

This uses local state intentionally (chicken-and-egg). Once it runs, update the `bucket` value in `environments/dev/main.tf` with your actual account ID, then proceed normally.

The bootstrap bucket is **completely separate** from ZeroDown's S3 bucket.

---

## Phase 1 — Heartbeat

A single agent reports its status to DynamoDB. No dashboard, no watcher, no auto-healing yet.

### What's built

| File | Purpose |
|------|---------|
| `modules/agent-heartbeat/main.tf` | DynamoDB tables + IAM policy + per-agent role factory |
| `modules/agent-heartbeat/variables.tf` | All configurable inputs |
| `modules/agent-heartbeat/outputs.tf` | ARNs and stream ARN for Phase 2/3 |
| `environments/dev/main.tf` | Root module calling the heartbeat module |
| `samples/heartbeat_writer/lambda_function.py` | Sample heartbeat write from a Lambda agent |

### DynamoDB tables

**`corelink-agent-heartbeats`** (current-state)
- PK: `agent_id` (String)
- One row per agent — overwritten on each heartbeat
- DynamoDB Streams: **enabled**, view type `NEW_AND_OLD_IMAGES`
  - Phase 2 reads the stream for the live dashboard
  - Phase 3 Lambda watcher triggers off the stream to flag stale/stuck/high-token agents
- All fields beyond the PK are schema-free attributes — any agent from any department writes whatever fields it needs without a table rebuild

**`corelink-agent-heartbeats-history`** (audit trail)
- PK: `agent_id` (String), SK: `timestamp` (String, ISO 8601)
- Append-only — every heartbeat is a new record
- Streams: not enabled (audit only)
- TTL attribute enabled by default to keep table size bounded

### Heartbeat record shape

```json
{
  "agent_id":    "sales-leadgen-01",
  "agent_name":  "Sales Lead Gen Agent",
  "department":  "Sales",
  "status":      "active | idle | stuck | error",
  "last_action": "processed lead batch",
  "token_usage": 42,
  "timestamp":   "2026-09-29T05:00:00+00:00",
  "...":         "any extra department-specific fields via the extra={} param"
}
```

### IAM design

- One shared write policy (`corelink-heartbeat-write`) scoped with a DynamoDB condition: `dynamodb:LeadingKeys == aws:PrincipalTag/AgentId`
- Each agent gets its own IAM role tagged with its `AgentId` — the condition enforces that an agent can only write records where `agent_id` matches its own tag
- Reads, scans, deletes, and admin operations are explicitly denied

### Adding a new agent

In `environments/dev/main.tf`, add an entry to `agent_definitions`:

```hcl
{
  id                 = "billing-reconcile-01"
  name               = "Billing Reconciliation Agent"
  department         = "Billing"
  principal_services = ["lambda.amazonaws.com"]
}
```

That's all — Terraform creates the role, tags it, and attaches the write policy.

### DynamoDB Streams — stream view type rationale

`NEW_AND_OLD_IMAGES` was chosen because:
- Phase 2 (dashboard) needs the current values of every field
- Phase 3 (watcher) needs to detect *what changed* — e.g. token_count delta, status flipping from active → stuck

---

## Phases 2–4 (not built yet)

| Phase | What it adds |
|-------|-------------|
| 2 | Live dashboard reading the current-state stream |
| 3 | Lambda watcher triggered by the stream — flags stale, stuck, or high-token-burn agents |
| 4 | Auto-healing — watcher acts automatically (restart, swap model, reroute) |

The `current_table_stream_arn` output from this module is the handoff point for both Phase 2 and Phase 3.
