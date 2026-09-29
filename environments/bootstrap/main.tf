terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # Intentionally local state — this is the one-time bootstrap that creates
  # the S3 bucket and lock table used by every other environment.
  # Run once, commit the resulting terraform.tfstate to the repo (or store
  # it somewhere safe), then never run terraform destroy here.
}

provider "aws" {
  region = var.aws_region
}

module "tf_backend" {
  source = "../../modules/tf-backend"

  bucket_name     = var.state_bucket_name
  lock_table_name = "corelink-ai-tf-locks"

  tags = {
    Project     = "corelink"
    Environment = "bootstrap"
    ManagedBy   = "terraform"
  }
}

module "github_oidc_role" {
  source = "../../modules/github-oidc-role"

  aws_account_id    = var.aws_account_id
  state_bucket_name = var.state_bucket_name

  # Create the GitHub OIDC provider — it doesn't exist in this account yet.
  # If you ever get "provider already exists" on a re-run, set this to false.
  create_oidc_provider = true

  tags = {
    Project     = "corelink"
    Environment = "bootstrap"
    ManagedBy   = "terraform"
  }
}

output "state_bucket_name" {
  value = module.tf_backend.bucket_name
}

output "lock_table_name" {
  value = module.tf_backend.lock_table_name
}

output "github_actions_role_arn" {
  description = "Paste this into .github/workflows/*.yml as AWS_ROLE_ARN — or it's already hardcoded since the account ID is known."
  value       = module.github_oidc_role.role_arn
}
