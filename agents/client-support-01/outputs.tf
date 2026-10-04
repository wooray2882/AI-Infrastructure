output "function_name" {
  description = "Lambda function name for client-support-01."
  value       = aws_lambda_function.support.function_name
}

output "function_arn" {
  description = "Lambda function ARN for client-support-01."
  value       = aws_lambda_function.support.arn
}
