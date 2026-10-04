output "function_name" {
  description = "Lambda function name for client-onboarding-01."
  value       = aws_lambda_function.onboarding.function_name
}

output "function_arn" {
  description = "Lambda function ARN for client-onboarding-01."
  value       = aws_lambda_function.onboarding.arn
}
