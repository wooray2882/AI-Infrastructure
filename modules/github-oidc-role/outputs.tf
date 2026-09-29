output "role_arn" {
  description = "ARN of the GitHub Actions IAM role. Use this as AWS_ROLE_ARN in the GitHub Actions workflow."
  value       = aws_iam_role.github_actions.arn
}

output "role_name" {
  description = "Name of the GitHub Actions IAM role."
  value       = aws_iam_role.github_actions.name
}
