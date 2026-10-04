output "function_name" {
  description = "Name of the agent runner Lambda. Invoke directly with {agent_id, task} to run a real agent task."
  value       = aws_lambda_function.runner.function_name
}

output "function_arn" {
  description = "ARN of the agent runner Lambda."
  value       = aws_lambda_function.runner.arn
}
