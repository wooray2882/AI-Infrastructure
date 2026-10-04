output "api_url" {
  description = "Base URL of the agent REST API. Pass as VITE_API_URL to the dashboard build."
  value       = aws_apigatewayv2_stage.default.invoke_url
}
