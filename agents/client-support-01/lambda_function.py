"""
client-support-01 — Client Relations: Client Support Agent

On each invocation:
1. Takes a client query from the event payload (falls back to a demo query)
2. Uses Claude via Bedrock to draft a helpful support response
3. Sends the response via SES
4. Writes a heartbeat

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENT_ID                 — client-support-01
  AGENT_NAME               — Client Support Agent
  AGENT_DEPARTMENT         — client-relations
  FROM_EMAIL               — your verified SES email/domain
  BEDROCK_MODEL_ID         — anthropic.claude-3-haiku-20240307-v1:0
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

CURRENT_TABLE  = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE  = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENT_ID       = os.environ["AGENT_ID"]
AGENT_NAME     = os.environ["AGENT_NAME"]
AGENT_DEPT     = os.environ["AGENT_DEPARTMENT"]
FROM_EMAIL     = os.environ["FROM_EMAIL"]
MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")

dynamodb       = boto3.resource("dynamodb")
current_table  = dynamodb.Table(CURRENT_TABLE)
history_table  = dynamodb.Table(HISTORY_TABLE)
bedrock        = boto3.client("bedrock-runtime")
ses            = boto3.client("ses")


def write_heartbeat(status: str, last_action: str, extra: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id":       AGENT_ID,
        "agent_name":     AGENT_NAME,
        "department":     AGENT_DEPT,
        "role":           "specialist",
        "status":         status,
        "last_action":    last_action,
        "tools":          "ses bedrock",
        "last_heartbeat": now,
        "timestamp":      now,
    }
    if extra:
        record.update(extra)
    current_table.put_item(Item=record)
    history_table.put_item(Item={**record, "record_id": str(uuid.uuid4())})


def draft_support_response(client_name: str, query: str) -> str:
    prompt = f"""You are a knowledgeable, empathetic client support agent for Corelink, an AI-powered business operations company.

A client has submitted a support request. Draft a helpful, professional response.

Client name: {client_name}
Client query: {query}

Your response should:
1. Acknowledge their question or concern directly
2. Provide a clear, actionable answer or next step
3. Offer to follow up if they need more help
4. Be warm but efficient — under 150 words
5. End with your name: "— The Corelink Support Team"

Return only the email body text."""

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"max_new_tokens": 512},
        }),
    )
    result = json.loads(response["body"].read())
    return result["output"]["message"]["content"][0]["text"]


def send_email(to_email: str, subject: str, body: str) -> str:
    response = ses.send_email(
        Source=FROM_EMAIL,
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": subject},
            "Body":    {"Text": {"Data": body}},
        },
    )
    return response["MessageId"]


def lambda_handler(event, context):
    print(f"[client-support-01] invoked — event: {json.dumps(event)}")

    write_heartbeat(status="online", last_action="started — reviewing support queue")

    # Support query comes from event; demo values used for scheduled heartbeat pings
    client_name = event.get("client_name", "Demo Client")
    query       = event.get("query",       "How do I access my monthly report?")
    to_email    = event.get("to_email",    FROM_EMAIL)
    subject     = event.get("subject",     f"Re: Support request from {client_name}")

    try:
        write_heartbeat(status="online", last_action=f"drafting response for {client_name}")

        response_body = draft_support_response(client_name, query)
        print(f"[client-support-01] response drafted for {client_name}")

        message_id = send_email(to_email, subject, response_body)
        print(f"[client-support-01] response sent — SES message ID: {message_id}")

        write_heartbeat(
            status="online",
            last_action=f"support response sent to {to_email}",
            extra={
                "last_client":    client_name,
                "last_query":     query[:100],
                "ses_message_id": message_id,
            },
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "agent_id":   AGENT_ID,
                "status":     "online",
                "client":     client_name,
                "message_id": message_id,
            }),
        }

    except ClientError as e:
        err = e.response["Error"]
        print(f"[client-support-01] error: {err['Code']}: {err['Message']}")
        write_heartbeat(
            status="error",
            last_action=f"failed: {err['Code']}",
            extra={"error_message": err["Message"]},
        )
        raise
