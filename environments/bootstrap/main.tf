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

output "state_bucket_name" {
  value = module.tf_backend.bucket_name
}

output "lock_table_name" {
  value = module.tf_backend.lock_table_name
}
