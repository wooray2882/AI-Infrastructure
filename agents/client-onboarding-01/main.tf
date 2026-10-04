terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

data "archive_file" "onboarding" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/client-onboarding-01.zip"
}

resource "aws_lambda_function" "onboarding" {
  function_name    = "${var.name_prefix}-agent-client-onboarding-01"
  filename         = data.archive_file.onboarding.output_path
  source_code_hash = data.archive_file.onboarding.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = var.agent_role_arn
  timeout          = 60

  environment {
    variables = {
      HEARTBEAT_CURRENT_TABLE = var.current_table_name
      HEARTBEAT_HISTORY_TABLE = var.history_table_name
      AGENT_ID                = "client-onboarding-01"
      AGENT_NAME              = "Client Onboarding Agent"
      AGENT_DEPARTMENT        = "client-relations"
      FROM_EMAIL              = var.from_email
      BEDROCK_MODEL_ID        = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "onboarding" {
  name              = "/aws/lambda/${aws_lambda_function.onboarding.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_iam_role_policy" "onboarding_logs" {
  name = "${var.name_prefix}-client-onboarding-01-logs"
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
# For real onboarding, invoke this Lambda directly with a client payload.
resource "aws_cloudwatch_event_rule" "onboarding_schedule" {
  name                = "${var.name_prefix}-client-onboarding-01-heartbeat"
  description         = "Fires client-onboarding-01 every 5 minutes to produce a live heartbeat"
  schedule_expression = "rate(5 minutes)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "onboarding_schedule" {
  rule      = aws_cloudwatch_event_rule.onboarding_schedule.name
  target_id = "client-onboarding-01"
  arn       = aws_lambda_function.onboarding.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.onboarding.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.onboarding_schedule.arn
}
