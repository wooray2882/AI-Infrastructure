terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Tool → IAM permission mapping
# Each key is a tool name an agent can declare in its tools list.
# The orchestrator role gets lambda_invoke so it can call specialist agents.
# ---------------------------------------------------------------------------
locals {
  tool_permissions = {
    heartbeat = {
      actions = [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
      ]
      resources = [
        aws_dynamodb_table.heartbeat_current.arn,
        aws_dynamodb_table.heartbeat_history.arn,
      ]
    }

    dynamodb = {
      actions = [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem",
      ]
      resources = ["arn:aws:dynamodb:*:*:table/*"]
    }

    rds = {
      actions = [
        "rds-data:ExecuteStatement",
        "rds-data:BatchExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:RollbackTransaction",
      ]
      resources = ["arn:aws:rds:*:*:cluster:*"]
    }

    s3 = {
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      resources = [
        "arn:aws:s3:::*",
        "arn:aws:s3:::*/*",
      ]
    }

    ses = {
      actions = [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ]
      resources = ["*"]
    }

    lambda_invoke = {
      actions   = ["lambda:InvokeFunction"]
      resources = ["arn:aws:lambda:*:*:function:corelink-agent-*"]
    }

    bedrock = {
      actions = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ]
      resources = [
        "arn:aws:bedrock:*::foundation-model/*",
        "arn:aws:bedrock:*:*:inference-profile/*",
      ]
    }

    # bedrock_agent — lets an agent call InvokeInlineAgent to run a Bedrock
    # inline agent with dynamically attached action groups (skills).
    bedrock_agent = {
      actions = [
        "bedrock-agent-runtime:InvokeInlineAgent",
      ]
      resources = ["*"]
    }

    secrets = {
      actions = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ]
      resources = ["arn:aws:secretsmanager:*:*:secret:corelink/*"]
    }

    registry_read = {
      actions = [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ]
      resources = [aws_dynamodb_table.heartbeat_current.arn]
    }
  }

  agents = { for a in var.agent_definitions : a.id => a }

  # Baseline tools every agent gets regardless of declared tools list.
  # heartbeat  = write own status to current-state + history tables
  # registry_read = scan the current-state table to discover other agents
  baseline_tools = ["heartbeat", "registry_read"]

  # Orchestrators also get lambda_invoke so they can call specialist agents
  agent_effective_tools = {
    for id, a in local.agents :
    id => toset(concat(
      a.tools,
      local.baseline_tools,
      a.role == "orchestrator" ? ["lambda_invoke"] : []
    ))
  }

  # Flatten: one entry per (agent, tool) pair — used to build per-tool policies
  agent_tool_pairs = flatten([
    for id, a in local.agents : [
      for tool in local.agent_effective_tools[id] : {
        agent_id = id
        tool     = tool
        key      = "${id}__${tool}"
      }
    ]
  ])
}

# ---------------------------------------------------------------------------
# Current-state table  (one row per agent, overwritten on each heartbeat)
# DynamoDB Streams enabled here — Phase 2 dashboard and Phase 3 watcher use it
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "heartbeat_current" {
  name         = var.current_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agent_id"

  attribute {
    name = "agent_id"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  dynamic "ttl" {
    for_each = var.ttl_attribute_enabled ? [1] : []
    content {
      attribute_name = "ttl"
      enabled        = true
    }
  }

  point_in_time_recovery {
    enabled = var.pitr_enabled
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "heartbeat-current-state" })
}

# ---------------------------------------------------------------------------
# History table  (append-only; every heartbeat is a new record)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "heartbeat_history" {
  name         = var.history_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agent_id"
  range_key    = "timestamp"

  attribute {
    name = "agent_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  dynamic "ttl" {
    for_each = var.history_ttl_attribute_enabled ? [1] : []
    content {
      attribute_name = "ttl"
      enabled        = true
    }
  }

  point_in_time_recovery {
    enabled = var.pitr_enabled
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "heartbeat-history" })
}

# ---------------------------------------------------------------------------
# Per-agent IAM roles
# Each role is tagged with AgentId, AgentName, Department, and Role so the
# orchestrator can query the registry and know what each agent can do.
# ---------------------------------------------------------------------------
resource "aws_iam_role" "agent" {
  for_each = local.agents

  name = "${var.name_prefix}-agent-${each.key}"

  assume_role_policy = data.aws_iam_policy_document.agent_assume_role[each.key].json

  tags = merge(var.tags, {
    AgentId    = each.key
    AgentName  = each.value.name
    Department = each.value.department
    AgentRole  = each.value.role
    AgentTools = join(" ", each.value.tools)
  })
}

data "aws_iam_policy_document" "agent_assume_role" {
  for_each = local.agents

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = each.value.principal_services
    }
    # No RoleSessionName condition — Lambda sets its own session name and
    # cannot be constrained to a specific value by the trust policy.
  }
}

# ---------------------------------------------------------------------------
# Per-tool IAM policies — one policy per (agent, tool) pair
# Each agent only gets policies for the tools it declares.
# ---------------------------------------------------------------------------
resource "aws_iam_policy" "agent_tool" {
  for_each = { for pair in local.agent_tool_pairs : pair.key => pair }

  name        = "${var.name_prefix}-${each.value.agent_id}-${each.value.tool}"
  description = "Grants ${each.value.agent_id} access to the ${each.value.tool} tool"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ToolAccess"
        Effect   = "Allow"
        Action   = local.tool_permissions[each.value.tool].actions
        Resource = local.tool_permissions[each.value.tool].resources
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "agent_tool" {
  for_each = { for pair in local.agent_tool_pairs : pair.key => pair }

  role       = aws_iam_role.agent[each.value.agent_id].name
  policy_arn = aws_iam_policy.agent_tool[each.key].arn
}

# ---------------------------------------------------------------------------
# Baseline policy — every agent can write heartbeats and read the registry
# This is created once and attached to all agent roles.
# ---------------------------------------------------------------------------
resource "aws_iam_policy" "baseline" {
  name        = "${var.name_prefix}-agent-baseline"
  description = "Baseline policy for all Corelink agents: heartbeat write + registry read"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "HeartbeatWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          aws_dynamodb_table.heartbeat_current.arn,
          aws_dynamodb_table.heartbeat_history.arn,
        ]
      },
      {
        Sid    = "RegistryRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [aws_dynamodb_table.heartbeat_current.arn]
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "baseline" {
  for_each = local.agents

  role       = aws_iam_role.agent[each.key].name
  policy_arn = aws_iam_policy.baseline.arn
}

# ---------------------------------------------------------------------------
# Explicit DENY — every agent is blocked from DynamoDB admin ops
# This is a guardrail regardless of what other policies grant.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "deny_admin" {
  statement {
    sid    = "DenyDynamoDBAdmin"
    effect = "Deny"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:UpdateTable",
      "dynamodb:DeleteItem",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "deny_admin" {
  name   = "${var.name_prefix}-deny-admin"
  policy = data.aws_iam_policy_document.deny_admin.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "deny_admin" {
  for_each = local.agents

  role       = aws_iam_role.agent[each.key].name
  policy_arn = aws_iam_policy.deny_admin.arn
}

# ---------------------------------------------------------------------------
# Organizations table
# Top-level tenant boundary. One org per account in v1.
# PK: org_id  — fields: name, created_at, template (default | custom)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "organizations" {
  name         = "${var.name_prefix}-organizations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "org_id"

  attribute {
    name = "org_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "org-config" })
}

# ---------------------------------------------------------------------------
# Departments table
# Each department belongs to one org. Agents reference dept_id.
# PK: dept_id  GSI: org_id (to list all departments in an org)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "departments" {
  name         = "${var.name_prefix}-departments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "dept_id"

  attribute {
    name = "dept_id"
    type = "S"
  }

  attribute {
    name = "org_id"
    type = "S"
  }

  global_secondary_index {
    name            = "org_id-index"
    hash_key        = "org_id"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "department-config" })
}

# ---------------------------------------------------------------------------
# Agent config table
# Source of truth for dynamically-created agents (created via dashboard UI).
# PK: agent_id  — fields: name, dept_id, org_id, role, system_prompt, active
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "agents" {
  name         = "${var.name_prefix}-agents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agent_id"

  attribute {
    name = "agent_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "agent-config" })
}

# ---------------------------------------------------------------------------
# Agent-to-skill assignment table
# Each row links one agent to one skill it has been granted.
# PK: agent_id  SK: skill_id
# Extra attributes (e.g. per-agent config) can be stored on each row.
# This table is the source of truth for which agent can use which skill.
# Dashboard attach/detach writes here; inline agent invocations read here.
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "agent_skills" {
  name         = "${var.name_prefix}-agent-skills"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agent_id"
  range_key    = "skill_id"

  attribute {
    name = "agent_id"
    type = "S"
  }

  attribute {
    name = "skill_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { TablePurpose = "agent-skill-assignments" })
}
