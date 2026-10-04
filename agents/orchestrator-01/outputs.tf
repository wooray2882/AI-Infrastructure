output "function_name" {
  description = "Lambda function name for orchestrator-01."
  value       = aws_lambda_function.orchestrator.function_name
}

output "function_arn" {
  description = "Lambda function ARN for orchestrator-01."
  value       = aws_lambda_function.orchestrator.arn
}
