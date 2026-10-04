variable "name_prefix" {
  type        = string
  description = "Prefix for all resource names."
}

variable "agent_role_arn" {
  type        = string
  description = "ARN of the IAM role created by the agent-heartbeat module for client-support-01."
}

variable "agent_role_id" {
  type        = string
  description = "ID (name) of the IAM role — used to attach the CloudWatch logs policy."
}

variable "current_table_name" {
  type        = string
  description = "Name of the DynamoDB current-state heartbeat table."
}

variable "history_table_name" {
  type        = string
  description = "Name of the DynamoDB heartbeat history table."
}

variable "from_email" {
  type        = string
  description = "Verified SES email address used as the From: address for support responses."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to all resources."
}
