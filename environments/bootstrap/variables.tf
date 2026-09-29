variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID."
  type        = string
  default     = "000622214837"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state. Use 'corelink-ai-tf-state-000622214837'."
  type        = string
  default     = "corelink-ai-tf-state-000622214837"
}
