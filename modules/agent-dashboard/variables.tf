variable "name_prefix" {
  type    = string
  default = "corelink"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "heartbeat_stream_arn" {
  description = "DynamoDB stream ARN from the agent-heartbeat module."
  type        = string
}

variable "heartbeat_current_table_arn" {
  description = "ARN of the current-state heartbeat table (for Lambda read permissions)."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
