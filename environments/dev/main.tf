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

  # Add one entry per agent that needs its own IAM role.
  # The id slug becomes part of the role name and must match the agent_id
  # value the agent writes into its heartbeat records.
  agent_definitions = [
    {
      id                 = "sales-leadgen-01"
      name               = "Sales Lead Gen Agent"
      department         = "Sales"
      principal_services = ["lambda.amazonaws.com"]
    },
  ]

  tags = {
    Project     = "corelink"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
