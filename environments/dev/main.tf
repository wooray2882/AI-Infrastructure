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
  ]

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
