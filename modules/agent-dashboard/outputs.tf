output "websocket_url" {
  description = "WebSocket URL for the dashboard to connect to."
  value       = "${aws_apigatewayv2_stage.ws.invoke_url}"
}

output "cloudfront_url" {
  description = "Public URL of the dashboard."
  value       = "https://${aws_cloudfront_distribution.dashboard.domain_name}"
}

output "dashboard_bucket" {
  description = "S3 bucket name — upload the built React app here."
  value       = aws_s3_bucket.dashboard.bucket
}

output "connections_table_name" {
  description = "DynamoDB table tracking active WebSocket connections."
  value       = aws_dynamodb_table.connections.name
}
