"""
agent-runner — Generic Bedrock Inline Agent runner

Two modes:
  Scheduled ping  (EventBridge): scans agents table, writes an online/idle
                                  heartbeat for every active agent.
  Direct invocation (payload):   runs a specific agent's full inline agent
                                  flow with dynamically attached skills.

Payload for direct invocation:
  {
    "agent_id": "client-onboarding-01",
    "task":     "Onboard Alex Johnson at Acme Corp. Email: alex@acme.com",
    # optional overrides:
    "client_name": "Alex Johnson",
    "to_email":    "alex@acme.com"
  }

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENTS_TABLE             — corelink-agents
  AGENT_SKILLS_TABLE       — corelink-agent-skills
  BEDROCK_MODEL_ID         — amazon.nova-micro-v1:0
  SKILL_EMAIL_LAMBDA_ARN   — ARN of the skill-email action group Lambda
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

CURRENT_TABLE          = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE          = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENTS_TABLE           = os.environ["AGENTS_TABLE"]
AGENT_SKILLS_TABLE     = os.environ["AGENT_SKILLS_TABLE"]
MODEL_ID               = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")
SKILL_EMAIL_LAMBDA_ARN = os.environ["SKILL_EMAIL_LAMBDA_ARN"]

dynamodb      = boto3.resource("dynamodb")
current_table = dynamodb.Table(CURRENT_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)
agents_table  = dynamodb.Table(AGENTS_TABLE)
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

SKILL_ACTION_GROUPS = {
    "email": {
        "actionGroupName": "EmailSkill",
        "description": "Send emails to clients via SES",
        "actionGroupExecutor": {"lambda": SKILL_EMAIL_LAMBDA_ARN},
        "apiSchema": {"payload": EMAIL_API_SCHEMA},
    }
}


def write_heartbeat(agent: dict, status: str, last_action: str, extra: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id":       agent["agent_id"],
        "agent_name":     agent.get("name", agent["agent_id"]),
        "department":     agent.get("department", "unknown"),
        "role":           agent.get("role", "specialist"),
        "status":         status,
        "last_action":    last_action,
        "tools":          agent.get("tools", "bedrock_agent ses dynamodb"),
        "last_heartbeat": now,
        "timestamp":      now,
    }
    if extra:
        record.update(extra)
    current_table.put_item(Item=record)
    history_table.put_item(Item={**record, "record_id": str(uuid.uuid4())})


def get_active_agents() -> list[dict]:
    resp = agents_table.scan(
        FilterExpression="active = :t",
        ExpressionAttributeValues={":t": True},
    )
    return resp.get("Items", [])


def get_agent(agent_id: str) -> dict | None:
    resp = agents_table.get_item(Key={"agent_id": agent_id})
    return resp.get("Item")


def get_skills(agent_id: str) -> list[str]:
    resp = skills_table.query(
        KeyConditionExpression=Key("agent_id").eq(agent_id),
    )
    return [item["skill_id"] for item in resp.get("Items", [])]


def build_action_groups(skills: list[str]) -> list[dict]:
    return [SKILL_ACTION_GROUPS[s] for s in skills if s in SKILL_ACTION_GROUPS]


def run_inline_agent(agent: dict, task: str, action_groups: list[dict]) -> str:
    system_prompt = agent.get(
        "system_prompt",
        f"You are {agent.get('name', 'an AI agent')} working for Corelink. "
        f"Complete the task using the available tools.",
    )
    kwargs = {
        "foundationModel": MODEL_ID,
        "instruction":     system_prompt,
        "sessionId":       str(uuid.uuid4()),
        "inputText":       task,
    }
    if action_groups:
        kwargs["actionGroups"] = action_groups

    response = bedrock_agent.invoke_inline_agent(**kwargs)
    output = ""
    for event in response.get("completion", []):
        chunk = event.get("chunk", {})
        if "bytes" in chunk:
            output += chunk["bytes"].decode("utf-8")
    return output or "Task completed."


def handle_scheduled_ping() -> dict:
    """Write heartbeats for all active agents without running AI tasks."""
    agents = get_active_agents()
    results = []
    for agent in agents:
        agent_id = agent["agent_id"]
        skills = get_skills(agent_id)
        status = "online" if skills else "idle"
        action = f"standby — {len(skills)} skill(s) assigned" if skills else "idle — no skills assigned"
        write_heartbeat(agent, status=status, last_action=action)
        results.append({"agent_id": agent_id, "status": status})
        print(f"[agent-runner] heartbeat written for {agent_id}: {status}")
    return {"agents_pinged": len(results), "results": results}


def handle_task(event: dict) -> dict:
    """Run a specific agent on a real task."""
    agent_id = event["agent_id"]
    task     = event["task"]

    agent = get_agent(agent_id)
    if not agent:
        raise ValueError(f"Agent '{agent_id}' not found in agents table")

    write_heartbeat(agent, status="online", last_action=f"starting task: {task[:80]}")

    skills        = get_skills(agent_id)
    action_groups = build_action_groups(skills)
    print(f"[agent-runner] {agent_id} — skills: {skills}, task: {task[:80]}")

    write_heartbeat(agent, status="online", last_action=f"running inline agent")
    result = run_inline_agent(agent, task, action_groups)
    print(f"[agent-runner] {agent_id} — result: {result[:200]}")

    write_heartbeat(
        agent,
        status="online",
        last_action=f"task complete: {task[:60]}",
        extra={"skills_used": " ".join(skills)},
    )
    return {"agent_id": agent_id, "status": "online", "skills": skills, "result": result}


def lambda_handler(event, context):
    print(f"[agent-runner] invoked — event: {json.dumps(event)}")

    # Scheduled EventBridge ping — no agent_id in payload
    if event.get("source") == "aws.events" or "agent_id" not in event:
        result = handle_scheduled_ping()
        return {"statusCode": 200, "body": json.dumps(result)}

    # Direct invocation with a real task
    try:
        result = handle_task(event)
        return {"statusCode": 200, "body": json.dumps(result)}
    except ClientError as e:
        err = e.response["Error"]
        print(f"[agent-runner] AWS error: {err['Code']}: {err['Message']}")
        raise
