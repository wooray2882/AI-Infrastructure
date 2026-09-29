"""
Sample heartbeat writer — called at discrete lifecycle moments inside an agent,
not on a polling schedule. Drop this logic into any agent's Lambda handler.

Environment variables required:
  HEARTBEAT_CURRENT_TABLE  — e.g. "corelink-agent-heartbeats"
  HEARTBEAT_HISTORY_TABLE  — e.g. "corelink-agent-heartbeats-history"
  AGENT_ID                 — must match the IAM role's AgentId tag
  AGENT_NAME               — human-readable, e.g. "Sales Lead Gen Agent"
  AGENT_DEPARTMENT         — e.g. "Sales"
  AWS_REGION               — standard Lambda env var, already set automatically
"""

import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

CURRENT_TABLE = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENT_ID      = os.environ["AGENT_ID"]
AGENT_NAME    = os.environ["AGENT_NAME"]
AGENT_DEPT    = os.environ["AGENT_DEPARTMENT"]

dynamodb = boto3.resource("dynamodb")
current_table = dynamodb.Table(CURRENT_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)


def write_heartbeat(
    *,
    status: str,
    last_action: str,
    token_usage: int,
    extra: dict | None = None,
) -> None:
    """
    Write one heartbeat to both tables.

    status      — "active" | "idle" | "stuck" | "error" | custom string
    last_action — short description of the last thing the agent did
    token_usage — running total of tokens consumed this session/invocation
    extra       — arbitrary k/v pairs; any department-specific fields go here
                  without requiring a schema change on the table
    """
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "agent_id":    AGENT_ID,
        "agent_name":  AGENT_NAME,
        "department":  AGENT_DEPT,
        "status":      status,
        "last_action": last_action,
        "token_usage": token_usage,
        "timestamp":   now,
    }

    # Merge any department-specific or agent-specific extra fields.
    # This keeps the schema generic — no table rebuild needed for new fields.
    if extra:
        record.update(extra)

    try:
        # Current-state: overwrite the single row for this agent
        current_table.put_item(Item=record)

        # History: append a new row (unique SK = ISO timestamp)
        history_record = {**record, "record_id": str(uuid.uuid4())}
        history_table.put_item(Item=history_record)

    except ClientError as e:
        # Surface the error but don't let a heartbeat failure crash the agent
        print(f"[heartbeat] write failed: {e.response['Error']['Code']}: {e.response['Error']['Message']}")
        raise


# ---------------------------------------------------------------------------
# Example Lambda handler — replace the body with real agent logic
# ---------------------------------------------------------------------------
def lambda_handler(event, context):
    write_heartbeat(
        status="active",
        last_action="started invocation",
        token_usage=0,
    )

    try:
        result = do_agent_work(event)

        write_heartbeat(
            status="idle",
            last_action="completed successfully",
            token_usage=result["tokens_used"],
            extra={"last_result_summary": result.get("summary", "")},
        )

        return {"statusCode": 200, "body": result}

    except Exception as exc:
        write_heartbeat(
            status="error",
            last_action=f"unhandled exception: {type(exc).__name__}",
            token_usage=0,
            extra={"error_message": str(exc)},
        )
        raise


def do_agent_work(event) -> dict:
    # Replace with real agent logic
    return {"tokens_used": 42, "summary": "processed lead batch"}
