variable "bucket_name" {
  description = "Name of the S3 bucket for Terraform state. Must be globally unique."
  type        = string
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking."
  type        = string
  default     = "corelink-ai-tf-locks"
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
