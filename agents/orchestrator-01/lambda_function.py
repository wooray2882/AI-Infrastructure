"""
orchestrator-01 — minimal proof-of-life Lambda.

Proves two things end to end:
  1. Baseline IAM write works: heartbeat lands in both DynamoDB tables
  2. registry_read works: can scan the current-state table to see all agents

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENT_ID                 — orchestrator-01
  AGENT_NAME               — Corelink Orchestrator
  AGENT_DEPARTMENT         — core
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

CURRENT_TABLE = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE  = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENT_ID       = os.environ["AGENT_ID"]
AGENT_NAME     = os.environ["AGENT_NAME"]
AGENT_DEPT     = os.environ["AGENT_DEPARTMENT"]

dynamodb      = boto3.resource("dynamodb")
current_table = dynamodb.Table(CURRENT_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)


def write_heartbeat(status: str, last_action: str, extra: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id":    AGENT_ID,
        "agent_name":  AGENT_NAME,
        "department":  AGENT_DEPT,
        "role":        "orchestrator",
        "status":      status,
        "last_action": last_action,
        "tools":       "lambda_invoke registry_read bedrock",
        "last_heartbeat": now,
        "timestamp":   now,
    }
    if extra:
        record.update(extra)

    current_table.put_item(Item=record)

    history_record = {**record, "record_id": str(uuid.uuid4())}
    history_table.put_item(Item=history_record)


def read_registry() -> list[dict]:
    response = current_table.scan(
        ProjectionExpression="agent_id, agent_name, #s, department, last_heartbeat",
        ExpressionAttributeNames={"#s": "status"},
    )
    return response.get("Items", [])


def lambda_handler(event, context):
    print(f"[orchestrator-01] invoked — event: {json.dumps(event)}")

    # Step 1: announce startup
    write_heartbeat(
        status="online",
        last_action="started — checking registry",
    )

    # Step 2: read the registry to prove registry_read permission works
    try:
        agents = read_registry()
        agent_count = len(agents)
        agent_ids   = [a.get("agent_id", "?") for a in agents]
        print(f"[orchestrator-01] registry has {agent_count} agent(s): {agent_ids}")

        # Step 3: report healthy with discovery result
        write_heartbeat(
            status="online",
            last_action=f"registry scan complete — found {agent_count} agent(s)",
            extra={"discovered_agents": " ".join(agent_ids)},
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "agent_id":    AGENT_ID,
                "status":      "online",
                "agent_count": agent_count,
                "agents":      agent_ids,
            }),
        }

    except ClientError as e:
        err = e.response["Error"]
        print(f"[orchestrator-01] registry read failed: {err['Code']}: {err['Message']}")

        write_heartbeat(
            status="error",
            last_action=f"registry read failed: {err['Code']}",
            extra={"error_message": err["Message"]},
        )
        raise
