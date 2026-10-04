output "lambda_arn" {
  description = "ARN of the skill-email action group Lambda."
  value       = aws_lambda_function.skill_email.arn
}

output "lambda_name" {
  description = "Name of the skill-email action group Lambda."
  value       = aws_lambda_function.skill_email.function_name
}

output "skill_id" {
  description = "Canonical skill identifier. Store this in the agent-skills assignment table."
  value       = "email"
}
