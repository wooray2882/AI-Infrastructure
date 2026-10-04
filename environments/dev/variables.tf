variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "from_email" {
  description = "Verified SES email address used by Client Relations agents as the From: address."
  type        = string
}
