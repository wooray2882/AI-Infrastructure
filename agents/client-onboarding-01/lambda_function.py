"""
client-onboarding-01 — Client Relations: Onboarding Agent

Uses Bedrock Inline Agents at runtime. Skills (action groups) are read from
the agent-skills DynamoDB table and attached dynamically to each invocation.

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENT_ID                 — client-onboarding-01
  AGENT_NAME               — Client Onboarding Agent
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


# OpenAPI schema for the email action group (inline so Lambda is self-contained)
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
    """Return list of skill_ids assigned to this agent."""
    resp = skills_table.query(
        KeyConditionExpression="agent_id = :aid",
        ExpressionAttributeValues={":aid": AGENT_ID},
    )
    return [item["skill_id"] for item in resp.get("Items", [])]


def build_action_groups(skills: list[str]) -> list[dict]:
    """Map skill_ids to Bedrock inline action group definitions."""
    groups = []
    if "email" in skills:
        groups.append({
            "actionGroupName": "EmailSkill",
            "description": "Send emails to clients via SES",
            "actionGroupExecutor": {"lambda": SKILL_EMAIL_LAMBDA_ARN},
            "apiSchema": {"payload": EMAIL_API_SCHEMA},
        })
    return groups


def invoke_inline_agent(client_name: str, company: str, to_email: str, action_groups: list[dict]) -> str:
    """Run a Bedrock inline agent to handle the onboarding task."""
    task = (
        f"You are a warm, professional client success agent for Corelink, "
        f"an AI-powered business operations company.\n\n"
        f"A new client has just signed up:\n"
        f"- Name: {client_name}\n"
        f"- Company: {company}\n"
        f"- Email: {to_email}\n\n"
        f"Please send them a warm onboarding welcome email. The email should:\n"
        f"1. Welcome them personally\n"
        f"2. Briefly explain what happens next (intro call, account setup, first check-in)\n"
        f"3. Ask them to reply with their preferred meeting time\n"
        f"4. Be professional but human, under 200 words\n\n"
        f"Use the send_email tool to send it now."
    )

    kwargs = {
        "foundationModel": MODEL_ID,
        "instruction": "You are a client onboarding specialist. Use the available tools to complete tasks.",
        "sessionId": str(uuid.uuid4()),
        "inputText": task,
    }
    if action_groups:
        kwargs["actionGroups"] = action_groups

    response = bedrock_agent.invoke_inline_agent(**kwargs)

    # Collect streamed completion text
    output_text = ""
    for event in response.get("completion", []):
        chunk = event.get("chunk", {})
        if "bytes" in chunk:
            output_text += chunk["bytes"].decode("utf-8")

    return output_text or "Onboarding email sent."


def lambda_handler(event, context):
    print(f"[client-onboarding-01] invoked — event: {json.dumps(event)}")

    write_heartbeat(status="online", last_action="started — preparing onboarding")

    client_name = event.get("client_name", "Alex Johnson")
    company     = event.get("company",     "Acme Corp")
    to_email    = event.get("to_email",    FROM_EMAIL)

    try:
        write_heartbeat(status="online", last_action=f"loading skills for {client_name}")
        skills = get_agent_skills()
        print(f"[client-onboarding-01] assigned skills: {skills}")

        action_groups = build_action_groups(skills)

        # If no skills are assigned and this is a scheduled heartbeat, stay idle
        if not skills and not event.get("client_name"):
            write_heartbeat(status="online", last_action="idle — no skills assigned yet")
            return {"statusCode": 200, "body": json.dumps({"agent_id": AGENT_ID, "status": "idle"})}

        write_heartbeat(status="online", last_action=f"running inline agent for {client_name} at {company}")
        result = invoke_inline_agent(client_name, company, to_email, action_groups)
        print(f"[client-onboarding-01] agent result: {result[:200]}")

        write_heartbeat(
            status="online",
            last_action=f"onboarding complete for {client_name} at {company}",
            extra={"last_client": client_name, "last_company": company, "skills_used": " ".join(skills)},
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "agent_id": AGENT_ID,
                "status":   "online",
                "client":   client_name,
                "company":  company,
                "skills":   skills,
                "result":   result,
            }),
        }

    except ClientError as e:
        err = e.response["Error"]
        print(f"[client-onboarding-01] error: {err['Code']}: {err['Message']}")
        write_heartbeat(
            status="error",
            last_action=f"failed: {err['Code']}",
            extra={"error_message": err["Message"]},
        )
        raise
