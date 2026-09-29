output "current_table_name" {
  description = "Name of the current-state heartbeat table."
  value       = aws_dynamodb_table.heartbeat_current.name
}

output "current_table_arn" {
  description = "ARN of the current-state heartbeat table."
  value       = aws_dynamodb_table.heartbeat_current.arn
}

output "current_table_stream_arn" {
  description = "Stream ARN for the current-state table. Pass this to the Phase 2 dashboard and Phase 3 Lambda watcher."
  value       = aws_dynamodb_table.heartbeat_current.stream_arn
}

output "history_table_name" {
  description = "Name of the history heartbeat table."
  value       = aws_dynamodb_table.heartbeat_history.name
}

output "history_table_arn" {
  description = "ARN of the history heartbeat table."
  value       = aws_dynamodb_table.heartbeat_history.arn
}

output "heartbeat_write_policy_arn" {
  description = "ARN of the shared write policy. Attach to any additional agent roles created outside this module."
  value       = aws_iam_policy.heartbeat_write.arn
}

output "agent_role_arns" {
  description = "Map of agent_id => IAM role ARN for all agents defined in agent_definitions."
  value       = { for k, r in aws_iam_role.agent : k => r.arn }
}
