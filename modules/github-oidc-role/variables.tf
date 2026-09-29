variable "role_name" {
  description = "Name of the IAM role GitHub Actions will assume."
  type        = string
  default     = "corelink-ai-github-actions-role"
}

variable "github_repo" {
  description = "GitHub repo in 'owner/repo' format. Only this repo can assume the role."
  type        = string
  default     = "wooray2882/AI-Infrastructure"
}

variable "aws_account_id" {
  description = "AWS account ID (12 digits)."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "S3 bucket name for Terraform state — role needs access to create and manage it."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name for Terraform state locking."
  type        = string
  default     = "corelink-ai-tf-locks"
}

variable "create_oidc_provider" {
  description = "Set to false if the GitHub OIDC provider already exists in this AWS account (ZeroDown may have created it). Set to true if this is the first GitHub Actions OIDC role in the account."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
