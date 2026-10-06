variable "name_prefix" {
  type        = string
  description = "Prefix for all resource names."
}

variable "agents_table_name" {
  type        = string
}

variable "agents_table_arn" {
  type        = string
}

variable "agent_skills_table_name" {
  type        = string
}

variable "agent_skills_table_arn" {
  type        = string
}

variable "heartbeat_current_table_name" {
  type        = string
}

variable "heartbeat_current_table_arn" {
  type        = string
}

variable "organizations_table_name" {
  type = string
}

variable "organizations_table_arn" {
  type = string
}

variable "departments_table_name" {
  type = string
}

variable "departments_table_arn" {
  type = string
}

variable "agent_runner_function_name" {
  type = string
}

variable "agent_runner_function_arn" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
