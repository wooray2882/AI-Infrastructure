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

output "agent_role_arns" {
  description = "Map of agent_id => IAM role ARN. The orchestrator uses these ARNs to invoke specialist agents."
  value       = { for k, r in aws_iam_role.agent : k => r.arn }
}

output "agent_role_ids" {
  description = "Map of agent_id => IAM role ID (name). Used to attach additional policies to a role."
  value       = { for k, r in aws_iam_role.agent : k => r.id }
}

output "agent_tool_policy_arns" {
  description = "Map of 'agent_id__tool' => IAM policy ARN for every (agent, tool) pair created."
  value       = { for k, p in aws_iam_policy.agent_tool : k => p.arn }
}

output "agents_table_name" {
  description = "Name of the agent config table (source of truth for dashboard-created agents)."
  value       = aws_dynamodb_table.agents.name
}

output "agents_table_arn" {
  description = "ARN of the agent config table."
  value       = aws_dynamodb_table.agents.arn
}

output "agent_skills_table_name" {
  description = "Name of the agent-to-skill assignment table."
  value       = aws_dynamodb_table.agent_skills.name
}

output "agent_skills_table_arn" {
  description = "ARN of the agent-to-skill assignment table."
  value       = aws_dynamodb_table.agent_skills.arn
}
