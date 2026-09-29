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
  description = "Enable TTL on the current-state table. When true, agents may set a 'ttl' Unix timestamp attribute and DynamoDB will auto-expire the record."
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
  description = "List of agents that should get their own IAM role. Each agent needs an id, name, department, and the AWS principal services allowed to assume the role."
  type = list(object({
    id                 = string       # short unique slug, e.g. "sales-leadgen-01"
    name               = string       # human-readable, e.g. "Sales Lead Gen Agent"
    department         = string       # e.g. "Sales", "Billing", "Tech"
    principal_services = list(string) # e.g. ["lambda.amazonaws.com"] or ["ec2.amazonaws.com"]
  }))
  default = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
