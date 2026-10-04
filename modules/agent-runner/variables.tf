variable "name_prefix" {
  type        = string
  description = "Prefix for all resource names."
}

variable "current_table_name" {
  type        = string
  description = "Name of the DynamoDB current-state heartbeat table."
}

variable "history_table_name" {
  type        = string
  description = "Name of the DynamoDB heartbeat history table."
}

variable "agents_table_name" {
  type        = string
  description = "Name of the DynamoDB agent config table."
}

variable "agents_table_arn" {
  type        = string
  description = "ARN of the DynamoDB agent config table."
}

variable "agent_skills_table_name" {
  type        = string
  description = "Name of the DynamoDB agent-skills assignment table."
}

variable "agent_skills_table_arn" {
  type        = string
  description = "ARN of the DynamoDB agent-skills assignment table."
}

variable "heartbeat_current_table_arn" {
  type        = string
  description = "ARN of the current-state heartbeat table (for IAM policy)."
}

variable "heartbeat_history_table_arn" {
  type        = string
  description = "ARN of the heartbeat history table (for IAM policy)."
}

variable "skill_email_lambda_arn" {
  type        = string
  description = "ARN of the skill-email action group Lambda."
}

variable "schedule_expression" {
  type        = string
  default     = "rate(5 minutes)"
  description = "EventBridge schedule for heartbeat pings."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to all resources."
}
