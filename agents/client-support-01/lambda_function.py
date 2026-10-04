"""
client-support-01 — Client Relations: Support Agent

Uses Bedrock Inline Agents at runtime. Skills (action groups) are read from
the agent-skills DynamoDB table and attached dynamically to each invocation.

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENT_ID                 — client-support-01
  AGENT_NAME               — Client Support Agent
  AGENT_DEPARTMENT         — client-relations
  FROM_EMAIL               — verified SES sender address
  BEDROCK_MODEL_ID         — amazon.nova-micro-v1:0
  AGENT_SKILLS_TABLE       — corelink-agent-skills
  SKILL_EMAIL_LAMBDA_ARN   — ARN of the skill-email action group Lambda
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

CURRENT_TABLE          = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE          = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENT_ID               = os.environ["AGENT_ID"]
AGENT_NAME             = os.environ["AGENT_NAME"]
AGENT_DEPT             = os.environ["AGENT_DEPARTMENT"]
FROM_EMAIL             = os.environ["FROM_EMAIL"]
MODEL_ID               = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")
AGENT_SKILLS_TABLE     = os.environ["AGENT_SKILLS_TABLE"]
SKILL_EMAIL_LAMBDA_ARN = os.environ["SKILL_EMAIL_LAMBDA_ARN"]

dynamodb      = boto3.resource("dynamodb")
current_table = dynamodb.Table(CURRENT_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)
skills_table  = dynamodb.Table(AGENT_SKILLS_TABLE)
bedrock_agent = boto3.client("bedrock-agent-runtime")


EMAIL_API_SCHEMA = json.dumps({
    "openapi": "3.0.0",
    "info": {"title": "Email Skill", "version": "1.0"},
    "paths": {
        "/send_email": {
            "post": {
                "operationId": "send_email",
                "summary": "Send an email via SES",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["to_email", "subject", "body"],
                                "properties": {
                                    "to_email": {"type": "string"},
                                    "subject":  {"type": "string"},
                                    "body":     {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "responses": {"200": {"description": "Email sent"}},
            }
        }
    },
})


def write_heartbeat(status: str, last_action: str, extra: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id":       AGENT_ID,
        "agent_name":     AGENT_NAME,
        "department":     AGENT_DEPT,
        "role":           "specialist",
        "status":         status,
        "last_action":    last_action,
        "tools":          "bedrock_agent dynamodb ses",
        "last_heartbeat": now,
        "timestamp":      now,
    }
    if extra:
        record.update(extra)
    current_table.put_item(Item=record)
    history_table.put_item(Item={**record, "record_id": str(uuid.uuid4())})


def get_agent_skills() -> list[str]:
    resp = skills_table.query(
        KeyConditionExpression="agent_id = :aid",
        ExpressionAttributeValues={":aid": AGENT_ID},
    )
    return [item["skill_id"] for item in resp.get("Items", [])]


def build_action_groups(skills: list[str]) -> list[dict]:
    groups = []
    if "email" in skills:
        groups.append({
            "actionGroupName": "EmailSkill",
            "description": "Send emails to clients via SES",
            "actionGroupExecutor": {"lambda": SKILL_EMAIL_LAMBDA_ARN},
            "apiSchema": {"payload": EMAIL_API_SCHEMA},
        })
    return groups


def invoke_inline_agent(client_name: str, query: str, to_email: str, action_groups: list[dict]) -> str:
    task = (
        f"You are a professional client support agent for Corelink.\n\n"
        f"A client needs help:\n"
        f"- Name: {client_name}\n"
        f"- Email: {to_email}\n"
        f"- Query: {query}\n\n"
        f"Please draft and send a helpful, empathetic support response. "
        f"The response should:\n"
        f"1. Acknowledge their issue with empathy\n"
        f"2. Provide a clear, actionable answer or next step\n"
        f"3. Let them know they can follow up if needed\n"
        f"4. Be professional but warm, under 150 words\n\n"
        f"Use the send_email tool to send your response now."
    )

    kwargs = {
        "foundationModel": MODEL_ID,
        "instruction": "You are a client support specialist. Use the available tools to complete tasks.",
        "sessionId": str(uuid.uuid4()),
        "inputText": task,
    }
    if action_groups:
        kwargs["actionGroups"] = action_groups

    response = bedrock_agent.invoke_inline_agent(**kwargs)

    output_text = ""
    for event in response.get("completion", []):
        chunk = event.get("chunk", {})
        if "bytes" in chunk:
            output_text += chunk["bytes"].decode("utf-8")

    return output_text or "Support response sent."


def lambda_handler(event, context):
    print(f"[client-support-01] invoked — event: {json.dumps(event)}")

    write_heartbeat(status="online", last_action="started — preparing support response")

    client_name = event.get("client_name", "Alex Johnson")
    query       = event.get("query",       "I need help getting started with my account.")
    to_email    = event.get("to_email",    FROM_EMAIL)

    try:
        write_heartbeat(status="online", last_action=f"loading skills for support ticket from {client_name}")
        skills = get_agent_skills()
        print(f"[client-support-01] assigned skills: {skills}")

        action_groups = build_action_groups(skills)

        write_heartbeat(status="online", last_action=f"running inline agent for {client_name}")
        result = invoke_inline_agent(client_name, query, to_email, action_groups)
        print(f"[client-support-01] agent result: {result[:200]}")

        write_heartbeat(
            status="online",
            last_action=f"support response sent to {client_name}",
            extra={"last_client": client_name, "skills_used": " ".join(skills)},
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "agent_id": AGENT_ID,
                "status":   "online",
                "client":   client_name,
                "skills":   skills,
                "result":   result,
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
