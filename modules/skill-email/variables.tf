variable "name_prefix" {
  description = "Resource name prefix (e.g. 'corelink')."
  type        = string
}

variable "from_email" {
  description = "SES-verified sender address. All agents using this skill send from here."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
