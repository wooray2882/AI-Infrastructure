variable "name_prefix" {
  description = "Prefix applied to all named resources (IAM roles, policies). Use a short identifier like 'corelink'."
  type        = string
}

variable "current_table_name" {
  description = "Name of the current-state DynamoDB table (one row per agent, overwritten on each heartbeat)."
  type        = string
  default     = "corelink-agent-heartbeats"
}

variable "history_table_name" {
  description = "Name of the history DynamoDB table (append-only; every heartbeat is a new record)."
  type        = string
  default     = "corelink-agent-heartbeats-history"
}

variable "ttl_attribute_enabled" {
  description = "Enable TTL on the current-state table."
  type        = bool
  default     = false
}

variable "history_ttl_attribute_enabled" {
  description = "Enable TTL on the history table. Recommended to keep table size bounded."
  type        = bool
  default     = true
}

variable "pitr_enabled" {
  description = "Enable point-in-time recovery on both tables."
  type        = bool
  default     = false
}

variable "agent_definitions" {
  description = <<-EOT
    List of agents. Each agent gets its own IAM role scoped to exactly the
    tools it needs. Supported tools:

      heartbeat      — write to the two heartbeat DynamoDB tables (all agents)
      dynamodb       — read/write any DynamoDB table (data agents)
      rds            — connect to RDS via Data API (database agents)
      s3             — read/write S3 objects (storage agents)
      ses            — send email via SES (comms agents)
      lambda_invoke  — invoke other Lambda-backed agents (orchestrator only)
      bedrock        — call Bedrock LLM endpoints (LLM agents)
      secrets        — read Secrets Manager values (any agent needing creds)

    role = "orchestrator" gives the agent a read on the heartbeat registry
    so it can discover available agents at runtime.
  EOT
  type = list(object({
    id                 = string
    name               = string
    department         = string
    role               = string        # e.g. "orchestrator", "database", "comms", "specialist"
    tools              = list(string)  # tool names from the supported list above
    principal_services = list(string)  # AWS services that may assume this role
  }))
  default = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
