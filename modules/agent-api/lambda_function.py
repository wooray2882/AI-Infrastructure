"""
agent-api — REST API for agent CRUD, skill management, orgs, departments, and orchestration

Routes (HTTP API Gateway v2):
  GET    /organizations                                list organizations
  POST   /organizations                                create organization
  GET    /organizations/{org_id}/departments           list departments in org
  POST   /organizations/{org_id}/departments           create department
  DELETE /departments/{dept_id}                        delete department
  GET    /agents                                       list all agents
  GET    /departments/{dept_id}/agents                 list agents in dept
  POST   /agents                                       create agent
  DELETE /agents/{agent_id}                            delete agent
  GET    /agents/{agent_id}/skills                     list skills for agent
  PUT    /agents/{agent_id}/skills/{skill_id}          attach skill
  DELETE /agents/{agent_id}/skills/{skill_id}          detach skill
  POST   /orchestrate                                  dispatch a task to the best-fit agent

Environment variables:
  AGENTS_TABLE            — corelink-agents
  AGENT_SKILLS_TABLE      — corelink-agent-skills
  HEARTBEAT_TABLE         — corelink-agent-heartbeats
  ORGS_TABLE              — corelink-organizations
  DEPTS_TABLE             — corelink-departments
  AGENT_RUNNER_FUNCTION   — corelink-agent-runner
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

AGENTS_TABLE           = os.environ["AGENTS_TABLE"]
AGENT_SKILLS_TABLE     = os.environ["AGENT_SKILLS_TABLE"]
HEARTBEAT_TABLE        = os.environ["HEARTBEAT_TABLE"]
ORGS_TABLE             = os.environ["ORGS_TABLE"]
DEPTS_TABLE            = os.environ["DEPTS_TABLE"]
AGENT_RUNNER_FUNCTION  = os.environ.get("AGENT_RUNNER_FUNCTION", "")

dynamodb      = boto3.resource("dynamodb")
lambda_client = boto3.client("lambda")
agents_table  = dynamodb.Table(AGENTS_TABLE)
skills_table  = dynamodb.Table(AGENT_SKILLS_TABLE)
hb_table      = dynamodb.Table(HEARTBEAT_TABLE)
orgs_table    = dynamodb.Table(ORGS_TABLE)
depts_table   = dynamodb.Table(DEPTS_TABLE)

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


def list_organizations() -> dict:
    items = orgs_table.scan().get("Items", [])
    return resp(200, sorted(items, key=lambda o: o.get("name", "")))


def create_organization(body: dict) -> dict:
    if not body.get("name"):
        return resp(400, {"error": "Missing required field: name"})
    org_id = body.get("org_id") or f"org-{uuid.uuid4().hex[:8]}"
    now    = datetime.now(timezone.utc).isoformat()
    item   = {
        "org_id":     org_id,
        "name":       body["name"],
        "template":   body.get("template", "default"),
        "created_at": now,
    }
    orgs_table.put_item(Item=item)
    return resp(201, item)


def list_departments(org_id: str) -> dict:
    items = depts_table.query(
        IndexName="org_id-index",
        KeyConditionExpression=Key("org_id").eq(org_id),
    ).get("Items", [])
    return resp(200, sorted(items, key=lambda d: d.get("name", "")))


def create_department(org_id: str, body: dict) -> dict:
    if not body.get("name"):
        return resp(400, {"error": "Missing required field: name"})
    dept_id  = body.get("dept_id") or f"dept-{uuid.uuid4().hex[:8]}"
    now      = datetime.now(timezone.utc).isoformat()
    item     = {
        "dept_id":    dept_id,
        "org_id":     org_id,
        "name":       body["name"],
        "created_at": now,
    }
    depts_table.put_item(Item=item)
    return resp(201, item)


def delete_department(dept_id: str) -> dict:
    depts_table.delete_item(Key={"dept_id": dept_id})
    return resp(200, {"deleted": dept_id})


def list_agents_by_dept(dept_id: str) -> dict:
    result = agents_table.scan(
        FilterExpression="dept_id = :d",
        ExpressionAttributeValues={":d": dept_id},
    )
    items = sorted(result.get("Items", []), key=lambda a: a.get("name", ""))
    return resp(200, items)


def orchestrate(body: dict) -> dict:
    """
    Pick the best-fit agent for a task and invoke it via agent-runner.

    Routing priority:
      1. body.agent_id — caller pinned a specific agent
      2. body.dept_id  — pick any active specialist in that department
      3. default       — find the orchestrator agent and let it delegate
    """
    task = (body.get("task") or "").strip()
    if not task:
        return resp(400, {"error": "Missing required field: task"})

    agent_id = body.get("agent_id")

    if not agent_id and body.get("dept_id"):
        # Pick the first active specialist in the named department
        result = agents_table.scan(
            FilterExpression="dept_id = :d AND active = :t",
            ExpressionAttributeValues={":d": body["dept_id"], ":t": True},
        )
        items = result.get("Items", [])
        specialists = [a for a in items if a.get("role") != "orchestrator"]
        if specialists:
            agent_id = specialists[0]["agent_id"]

    if not agent_id:
        # Fall back to the orchestrator agent
        result = agents_table.scan(
            FilterExpression="#r = :r AND active = :t",
            ExpressionAttributeNames={"#r": "role"},
            ExpressionAttributeValues={":r": "orchestrator", ":t": True},
        )
        items = result.get("Items", [])
        if items:
            agent_id = items[0]["agent_id"]

    if not agent_id:
        return resp(404, {"error": "No suitable agent found. Create an agent first."})

    if not AGENT_RUNNER_FUNCTION:
        return resp(503, {"error": "AGENT_RUNNER_FUNCTION not configured."})

    payload = {"agent_id": agent_id, "task": task}
    invoke_resp = lambda_client.invoke(
        FunctionName=AGENT_RUNNER_FUNCTION,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode(),
    )
    raw = invoke_resp["Payload"].read()
    runner_result = json.loads(raw)

    # agent-runner returns {"statusCode": 200, "body": "{...}"}
    inner = runner_result.get("body", "{}")
    try:
        data = json.loads(inner)
    except Exception:
        data = {"result": inner}

    return resp(200, {
        "agent_id": agent_id,
        "task":     task,
        "result":   data.get("result", ""),
        "skills":   data.get("skills", []),
    })


def list_agents() -> dict:
    result = agents_table.scan()
    items = sorted(result.get("Items", []), key=lambda a: a.get("name", ""))
    return resp(200, items)


def create_agent(body: dict) -> dict:
    required = ["name", "role"]
    missing  = [f for f in required if not body.get(f)]
    if missing:
        return resp(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    dept_id  = body.get("dept_id", "")
    agent_id = body.get("agent_id") or f"{dept_id or 'agent'}-{uuid.uuid4().hex[:8]}"
    now      = datetime.now(timezone.utc).isoformat()

    item = {
        "agent_id":      agent_id,
        "name":          body["name"],
        "dept_id":       dept_id,
        "org_id":        body.get("org_id", ""),
        "department":    body.get("department", ""),  # kept for backward compat
        "role":          body["role"],
        "model_id":      body.get("model_id", "amazon.nova-micro-v1:0"),
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

    # GET /organizations
    if method == "GET" and parts == ["organizations"]:
        return list_organizations()

    # POST /organizations
    if method == "POST" and parts == ["organizations"]:
        return create_organization(body)

    # GET /organizations/{org_id}/departments
    if method == "GET" and len(parts) == 3 and parts[0] == "organizations" and parts[2] == "departments":
        return list_departments(parts[1])

    # POST /organizations/{org_id}/departments
    if method == "POST" and len(parts) == 3 and parts[0] == "organizations" and parts[2] == "departments":
        return create_department(parts[1], body)

    # DELETE /departments/{dept_id}
    if method == "DELETE" and len(parts) == 2 and parts[0] == "departments":
        return delete_department(parts[1])

    # GET /departments/{dept_id}/agents
    if method == "GET" and len(parts) == 3 and parts[0] == "departments" and parts[2] == "agents":
        return list_agents_by_dept(parts[1])

    # POST /orchestrate
    if method == "POST" and parts == ["orchestrate"]:
        return orchestrate(body)

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
