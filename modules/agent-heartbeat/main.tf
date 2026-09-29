terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
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

  # Phase 2/3: NEW_AND_OLD_IMAGES lets the dashboard see current values and
  # lets the watcher detect what changed (e.g. token_count delta, status flip)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # TTL — off by default; set ttl_attribute_enabled = true in tfvars to use
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

  tags = merge(var.tags, {
    TablePurpose = "heartbeat-current-state"
  })
}

# ---------------------------------------------------------------------------
# History table  (append-only; every heartbeat is a new record)
# No streams needed here — audit trail only
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

  # TTL on history is usually desirable to keep table size bounded
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

  tags = merge(var.tags, {
    TablePurpose = "heartbeat-history"
  })
}

# ---------------------------------------------------------------------------
# IAM — one reusable policy template; each agent gets its own role
# The condition locks each agent to writing only its own record
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "heartbeat_write" {
  statement {
    sid    = "WriteCurrentStateOwnRecord"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]
    resources = [aws_dynamodb_table.heartbeat_current.arn]

    # Enforce that agent_id in the item == the role's AgentId tag
    condition {
      test     = "ForAllValues:StringEquals"
      variable = "dynamodb:LeadingKeys"
      values   = ["$${aws:PrincipalTag/AgentId}"]
    }
  }

  statement {
    sid    = "WriteHistoryOwnRecord"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
    ]
    resources = [aws_dynamodb_table.heartbeat_history.arn]

    condition {
      test     = "ForAllValues:StringEquals"
      variable = "dynamodb:LeadingKeys"
      values   = ["$${aws:PrincipalTag/AgentId}"]
    }
  }

  # Explicitly deny reads and all other table operations
  statement {
    sid    = "DenyReadAndAdmin"
    effect = "Deny"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:DeleteItem",
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:UpdateTable",
    ]
    resources = [
      aws_dynamodb_table.heartbeat_current.arn,
      aws_dynamodb_table.heartbeat_history.arn,
    ]
  }
}

resource "aws_iam_policy" "heartbeat_write" {
  name        = "${var.name_prefix}-heartbeat-write"
  description = "Allows an agent to write its own heartbeat records; scoped by AgentId principal tag"
  policy      = data.aws_iam_policy_document.heartbeat_write.json

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Per-agent role factory
# Call module with agent_definitions = [{id, name, department}, ...]
# ---------------------------------------------------------------------------
resource "aws_iam_role" "agent" {
  for_each = { for a in var.agent_definitions : a.id => a }

  name = "${var.name_prefix}-agent-${each.key}"

  assume_role_policy = data.aws_iam_policy_document.agent_assume_role[each.key].json

  tags = merge(var.tags, {
    AgentId     = each.key
    AgentName   = each.value.name
    Department  = each.value.department
  })
}

data "aws_iam_policy_document" "agent_assume_role" {
  for_each = { for a in var.agent_definitions : a.id => a }

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = each.value.principal_services
    }

    # When assuming the role, the caller must supply the AgentId session tag
    # matching this agent's id — prevents role misuse across agents
    condition {
      test     = "StringEquals"
      variable = "sts:RoleSessionName"
      values   = [each.key]
    }
  }
}

resource "aws_iam_role_policy_attachment" "agent_heartbeat" {
  for_each = { for a in var.agent_definitions : a.id => a }

  role       = aws_iam_role.agent[each.key].name
  policy_arn = aws_iam_policy.heartbeat_write.arn
}
