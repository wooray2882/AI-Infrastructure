output "current_table_stream_arn" {
  description = "Pass this to the Phase 2 dashboard and Phase 3 Lambda watcher."
  value       = module.agent_heartbeat.current_table_stream_arn
}

output "agent_role_arns" {
  value = module.agent_heartbeat.agent_role_arns
}
