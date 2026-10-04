"""
agent-api — REST API for agent CRUD and skill management

Routes (HTTP API Gateway v2):
  GET    /agents                              list all agents
  POST   /agents                              create agent
  DELETE /agents/{agent_id}                   delete agent
  GET    /agents/{agent_id}/skills            list skills for agent
  PUT    /agents/{agent_id}/skills/{skill_id} attach skill to agent
  DELETE /agents/{agent_id}/skills/{skill_id} detach skill from agent

Environment variables:
  AGENTS_TABLE        — corelink-agents
  AGENT_SKILLS_TABLE  — corelink-agent-skills
  HEARTBEAT_TABLE     — corelink-agent-heartbeats
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

AGENTS_TABLE       = os.environ["AGENTS_TABLE"]
AGENT_SKILLS_TABLE = os.environ["AGENT_SKILLS_TABLE"]
HEARTBEAT_TABLE    = os.environ["HEARTBEAT_TABLE"]

dynamodb      = boto3.resource("dynamodb")
agents_table  = dynamodb.Table(AGENTS_TABLE)
skills_table  = dynamodb.Table(AGENT_SKILLS_TABLE)
hb_table      = dynamodb.Table(HEARTBEAT_TABLE)

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def resp(status: int, body: object) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def list_agents() -> dict:
    result = agents_table.scan()
    items = sorted(result.get("Items", []), key=lambda a: a.get("name", ""))
    return resp(200, items)


def create_agent(body: dict) -> dict:
    required = ["name", "department", "role"]
    missing  = [f for f in required if not body.get(f)]
    if missing:
        return resp(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    agent_id = body.get("agent_id") or f"{body['department']}-{uuid.uuid4().hex[:8]}"
    now      = datetime.now(timezone.utc).isoformat()

    item = {
        "agent_id":      agent_id,
        "name":          body["name"],
        "department":    body["department"],
        "role":          body["role"],
        "system_prompt": body.get("system_prompt", ""),
        "tools":         body.get("tools", "bedrock_agent ses dynamodb"),
        "active":        True,
        "created_at":    now,
    }
    agents_table.put_item(Item=item)
    return resp(201, item)


def delete_agent(agent_id: str) -> dict:
    # Remove from agents config table
    agents_table.delete_item(Key={"agent_id": agent_id})

    # Remove all skill assignments for this agent
    skill_rows = skills_table.query(
        KeyConditionExpression=Key("agent_id").eq(agent_id)
    ).get("Items", [])
    for row in skill_rows:
        skills_table.delete_item(Key={"agent_id": agent_id, "skill_id": row["skill_id"]})

    # Remove heartbeat record so it disappears from the dashboard
    hb_table.delete_item(Key={"agent_id": agent_id})

    return resp(200, {"deleted": agent_id})


def list_skills(agent_id: str) -> dict:
    items = skills_table.query(
        KeyConditionExpression=Key("agent_id").eq(agent_id)
    ).get("Items", [])
    return resp(200, [i["skill_id"] for i in items])


def attach_skill(agent_id: str, skill_id: str) -> dict:
    skills_table.put_item(Item={
        "agent_id":   agent_id,
        "skill_id":   skill_id,
        "attached_at": datetime.now(timezone.utc).isoformat(),
    })
    return resp(200, {"agent_id": agent_id, "skill_id": skill_id, "attached": True})


def detach_skill(agent_id: str, skill_id: str) -> dict:
    skills_table.delete_item(Key={"agent_id": agent_id, "skill_id": skill_id})
    return resp(200, {"agent_id": agent_id, "skill_id": skill_id, "attached": False})


def lambda_handler(event, _context):
    method   = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    raw_path = event.get("rawPath", "/")
    body_raw = event.get("body", "{}")
    try:
        body = json.loads(body_raw or "{}")
    except Exception:
        body = {}

    # Strip /prod prefix if present from API Gateway stage
    path = raw_path.removeprefix("/prod")

    print(f"[agent-api] {method} {path}")

    # OPTIONS preflight
    if method == "OPTIONS":
        return resp(200, {})

    parts = [p for p in path.strip("/").split("/") if p]

    # GET /agents
    if method == "GET" and parts == ["agents"]:
        return list_agents()

    # POST /agents
    if method == "POST" and parts == ["agents"]:
        return create_agent(body)

    # DELETE /agents/{agent_id}
    if method == "DELETE" and len(parts) == 2 and parts[0] == "agents":
        return delete_agent(parts[1])

    # GET /agents/{agent_id}/skills
    if method == "GET" and len(parts) == 3 and parts[0] == "agents" and parts[2] == "skills":
        return list_skills(parts[1])

    # PUT /agents/{agent_id}/skills/{skill_id}
    if method == "PUT" and len(parts) == 4 and parts[0] == "agents" and parts[2] == "skills":
        return attach_skill(parts[1], parts[3])

    # DELETE /agents/{agent_id}/skills/{skill_id}
    if method == "DELETE" and len(parts) == 4 and parts[0] == "agents" and parts[2] == "skills":
        return detach_skill(parts[1], parts[3])

    return resp(404, {"error": f"No route for {method} {path}"})
