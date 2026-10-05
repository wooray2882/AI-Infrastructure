terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # Run environments/bootstrap first to create this bucket and lock table.
  # Replace <account-id> with your AWS account ID before running terraform init.
  backend "s3" {
    bucket         = "corelink-ai-tf-state-000622214837"
    key            = "ai-infrastructure/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "corelink-ai-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

module "agent_heartbeat" {
  source = "../../modules/agent-heartbeat"

  name_prefix        = "corelink"
  current_table_name = "corelink-agent-heartbeats"
  history_table_name = "corelink-agent-heartbeats-history"

  ttl_attribute_enabled         = false
  history_ttl_attribute_enabled = true
  pitr_enabled                  = false

  # Each agent declares its role and the exact tools it needs.
  # Terraform creates one IAM policy per tool per agent — no agent can call
  # a service outside its declared tools list.
  agent_definitions = [
    # ── Orchestrator ───────────────────────────────────────────────────────
    # Knows which agents exist (reads registry), delegates via Lambda invoke.
    # Does not do domain work itself.
    {
      id                 = "orchestrator-01"
      name               = "Corelink Orchestrator"
      department         = "core"
      role               = "orchestrator"
      tools              = ["heartbeat", "lambda_invoke"]   # registry_read added automatically
      principal_services = ["lambda.amazonaws.com"]
    },

    # ── Specialist: Database ────────────────────────────────────────────────
    # Handles all schema design, migrations, and data queries.
    # Cannot send email, invoke other agents, or touch S3.
    {
      id                 = "db-specialist-01"
      name               = "Database Specialist Agent"
      department         = "tech"
      role               = "database"
      tools              = ["heartbeat", "dynamodb", "rds", "secrets"]
      principal_services = ["lambda.amazonaws.com"]
    },

    # ── Specialist: Communications ──────────────────────────────────────────
    # Sends email only. Cannot touch databases or invoke other agents.
    {
      id                 = "comms-specialist-01"
      name               = "Communications Specialist Agent"
      department         = "comms"
      role               = "comms"
      tools              = ["heartbeat", "ses"]
      principal_services = ["lambda.amazonaws.com"]
    },

    # ── Specialist: Sales Lead Gen ──────────────────────────────────────────
    # Enriches and stores leads. Has data access + email + LLM for drafting.
    {
      id                 = "sales-leadgen-01"
      name               = "Sales Lead Gen Agent"
      department         = "sales"
      role               = "specialist"
      tools              = ["heartbeat", "dynamodb", "ses", "bedrock", "secrets"]
      principal_services = ["lambda.amazonaws.com"]
    },

    # Client-relations agents are now dynamic — defined in DynamoDB, not here.
    # See aws_dynamodb_table_item resources below and module.agent_runner.
  ]

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

module "agent_dashboard" {
  source = "../../modules/agent-dashboard"

  name_prefix                 = "corelink"
  aws_region                  = var.aws_region
  heartbeat_stream_arn        = module.agent_heartbeat.current_table_stream_arn
  heartbeat_current_table_arn = module.agent_heartbeat.current_table_arn

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Agent: orchestrator-01
# Minimal proof-of-life Lambda — writes heartbeat + reads agent registry.
# Uses the IAM role already created by module.agent_heartbeat.
# ---------------------------------------------------------------------------
module "orchestrator_01" {
  source = "../../agents/orchestrator-01"

  name_prefix        = "corelink"
  agent_role_arn     = module.agent_heartbeat.agent_role_arns["orchestrator-01"]
  agent_role_id      = module.agent_heartbeat.agent_role_ids["orchestrator-01"]
  current_table_name = module.agent_heartbeat.current_table_name
  history_table_name = module.agent_heartbeat.history_table_name

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Agent: client-onboarding-01
# AI-powered onboarding email agent — Bedrock (Claude Haiku) + SES
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Agent API — REST CRUD for agents and skill assignments
# ---------------------------------------------------------------------------
module "agent_api" {
  source = "../../modules/agent-api"

  name_prefix                  = "corelink"
  agents_table_name            = module.agent_heartbeat.agents_table_name
  agents_table_arn             = module.agent_heartbeat.agents_table_arn
  agent_skills_table_name      = module.agent_heartbeat.agent_skills_table_name
  agent_skills_table_arn       = module.agent_heartbeat.agent_skills_table_arn
  heartbeat_current_table_name = module.agent_heartbeat.current_table_name
  heartbeat_current_table_arn  = module.agent_heartbeat.current_table_arn
  organizations_table_name     = module.agent_heartbeat.organizations_table_name
  organizations_table_arn      = module.agent_heartbeat.organizations_table_arn
  departments_table_name       = module.agent_heartbeat.departments_table_name
  departments_table_arn        = module.agent_heartbeat.departments_table_arn

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Agent Runner
# One Lambda that heartbeats all dynamic agents and executes tasks on demand.
# ---------------------------------------------------------------------------
module "agent_runner" {
  source = "../../modules/agent-runner"

  name_prefix                 = "corelink"
  current_table_name          = module.agent_heartbeat.current_table_name
  history_table_name          = module.agent_heartbeat.history_table_name
  agents_table_name           = module.agent_heartbeat.agents_table_name
  agents_table_arn            = module.agent_heartbeat.agents_table_arn
  agent_skills_table_name     = module.agent_heartbeat.agent_skills_table_name
  agent_skills_table_arn      = module.agent_heartbeat.agent_skills_table_arn
  heartbeat_current_table_arn = module.agent_heartbeat.current_table_arn
  heartbeat_history_table_arn = module.agent_heartbeat.history_table_arn
  skill_email_lambda_arn      = module.skill_email.lambda_arn

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Default organization — seeded on first apply, managed by the dashboard UI
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table_item" "default_org" {
  table_name = module.agent_heartbeat.organizations_table_name
  hash_key   = "org_id"

  item = jsonencode({
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Corelink" }
    template   = { S = "default" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

# ---------------------------------------------------------------------------
# Default departments — seeded from the standard business template
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table_item" "dept_sales" {
  table_name = module.agent_heartbeat.departments_table_name
  hash_key   = "dept_id"

  item = jsonencode({
    dept_id    = { S = "dept-sales" }
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Sales" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

resource "aws_dynamodb_table_item" "dept_client_relations" {
  table_name = module.agent_heartbeat.departments_table_name
  hash_key   = "dept_id"

  item = jsonencode({
    dept_id    = { S = "dept-client-relations" }
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Client Relations" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

resource "aws_dynamodb_table_item" "dept_billing" {
  table_name = module.agent_heartbeat.departments_table_name
  hash_key   = "dept_id"

  item = jsonencode({
    dept_id    = { S = "dept-billing" }
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Billing" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

resource "aws_dynamodb_table_item" "dept_comms" {
  table_name = module.agent_heartbeat.departments_table_name
  hash_key   = "dept_id"

  item = jsonencode({
    dept_id    = { S = "dept-comms" }
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Communications" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

resource "aws_dynamodb_table_item" "dept_tech" {
  table_name = module.agent_heartbeat.departments_table_name
  hash_key   = "dept_id"

  item = jsonencode({
    dept_id    = { S = "dept-tech" }
    org_id     = { S = "org-corelink-default" }
    name       = { S = "Tech" }
    created_at = { S = "2026-10-05T00:00:00Z" }
  })
}

# ---------------------------------------------------------------------------
# Dynamic agents — seeded via DynamoDB records, managed by the dashboard UI
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table_item" "agent_client_onboarding" {
  table_name = module.agent_heartbeat.agents_table_name
  hash_key   = "agent_id"

  item = jsonencode({
    agent_id      = { S = "client-onboarding-01" }
    name          = { S = "Client Onboarding Agent" }
    department    = { S = "client-relations" }
    dept_id       = { S = "dept-client-relations" }
    org_id        = { S = "org-corelink-default" }
    role          = { S = "specialist" }
    active        = { BOOL = true }
    system_prompt = { S = "You are a warm, professional client success agent for Corelink, an AI-powered business operations company. Your job is to onboard new clients by sending them a personalized welcome email. Be human, concise, and helpful." }
    tools         = { S = "bedrock_agent ses dynamodb" }
  })
}

resource "aws_dynamodb_table_item" "agent_client_support" {
  table_name = module.agent_heartbeat.agents_table_name
  hash_key   = "agent_id"

  item = jsonencode({
    agent_id      = { S = "client-support-01" }
    name          = { S = "Client Support Agent" }
    department    = { S = "client-relations" }
    dept_id       = { S = "dept-client-relations" }
    org_id        = { S = "org-corelink-default" }
    role          = { S = "specialist" }
    active        = { BOOL = true }
    system_prompt = { S = "You are a professional and empathetic client support agent for Corelink. Your job is to respond to client queries with clear, helpful, and warm support responses. Keep replies under 150 words." }
    tools         = { S = "bedrock_agent ses dynamodb" }
  })
}

# ---------------------------------------------------------------------------
# Skill: email
# Bedrock action group Lambda that sends emails via SES.
# Agents attach this skill at runtime via the agent-skills table.
# ---------------------------------------------------------------------------
module "skill_email" {
  source = "../../modules/skill-email"

  name_prefix = "corelink"
  from_email  = var.from_email

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}


output "orchestrator_function_name" {
  description = "Invoke this Lambda to fire a real heartbeat: aws lambda invoke --function-name <name> /tmp/out.json"
  value       = module.orchestrator_01.function_name
}

output "agent_runner_function_name" {
  description = "Invoke with {agent_id, task} to run any dynamic agent. Scheduled pings run automatically."
  value       = module.agent_runner.function_name
}

output "websocket_url" {
  description = "Set this as VITE_WS_URL when building the dashboard."
  value       = module.agent_dashboard.websocket_url
}

output "dashboard_url" {
  description = "CloudFront URL for the live dashboard."
  value       = module.agent_dashboard.cloudfront_url
}

output "dashboard_bucket" {
  description = "Upload the built React app here: aws s3 sync app/dashboard/dist s3://<bucket>"
  value       = module.agent_dashboard.dashboard_bucket
}

output "agent_skills_table_name" {
  description = "DynamoDB table that maps agent_id → skill_id assignments."
  value       = module.agent_heartbeat.agent_skills_table_name
}

output "skill_email_lambda_arn" {
  description = "ARN of the email skill action group Lambda."
  value       = module.skill_email.lambda_arn
}

output "agent_api_url" {
  description = "REST API base URL. Set as VITE_API_URL in the dashboard build."
  value       = module.agent_api.api_url
}
