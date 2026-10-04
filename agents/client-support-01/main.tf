terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

data "archive_file" "support" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/client-support-01.zip"
}

resource "aws_lambda_function" "support" {
  function_name    = "${var.name_prefix}-agent-client-support-01"
  filename         = data.archive_file.support.output_path
  source_code_hash = data.archive_file.support.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = var.agent_role_arn
  timeout          = 60

  environment {
    variables = {
      HEARTBEAT_CURRENT_TABLE = var.current_table_name
      HEARTBEAT_HISTORY_TABLE = var.history_table_name
      AGENT_ID                = "client-support-01"
      AGENT_NAME              = "Client Support Agent"
      AGENT_DEPARTMENT        = "client-relations"
      FROM_EMAIL              = var.from_email
      BEDROCK_MODEL_ID        = "anthropic.claude-3-haiku-20240307-v1:0"
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "support" {
  name              = "/aws/lambda/${aws_lambda_function.support.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_iam_role_policy" "support_logs" {
  name = "${var.name_prefix}-client-support-01-logs"
  role = var.agent_role_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

# EventBridge schedule — fires every 5 minutes as a heartbeat keep-alive.
# For real support tickets, invoke this Lambda directly with a client query payload.
resource "aws_cloudwatch_event_rule" "support_schedule" {
  name                = "${var.name_prefix}-client-support-01-heartbeat"
  description         = "Fires client-support-01 every 5 minutes to produce a live heartbeat"
  schedule_expression = "rate(5 minutes)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "support_schedule" {
  rule      = aws_cloudwatch_event_rule.support_schedule.name
  target_id = "client-support-01"
  arn       = aws_lambda_function.support.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.support.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.support_schedule.arn
}
