terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

data "archive_file" "runner" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/agent-runner.zip"
}

resource "aws_iam_role" "runner" {
  name = "${var.name_prefix}-agent-runner"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "runner" {
  name = "${var.name_prefix}-agent-runner-policy"
  role = aws_iam_role.runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid    = "HeartbeatWrite"
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = [
          var.heartbeat_current_table_arn,
          var.heartbeat_history_table_arn,
        ]
      },
      {
        Sid    = "AgentConfigRead"
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query"]
        Resource = [var.agents_table_arn]
      },
      {
        Sid    = "SkillsRead"
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:Query"]
        Resource = [var.agent_skills_table_arn]
      },
      {
        Sid      = "BedrockInlineAgent"
        Effect   = "Allow"
        Action   = ["bedrock-agent-runtime:InvokeInlineAgent"]
        Resource = ["*"]
      },
    ]
  })
}

resource "aws_lambda_function" "runner" {
  function_name    = "${var.name_prefix}-agent-runner"
  filename         = data.archive_file.runner.output_path
  source_code_hash = data.archive_file.runner.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.runner.arn
  timeout          = 300

  environment {
    variables = {
      HEARTBEAT_CURRENT_TABLE = var.current_table_name
      HEARTBEAT_HISTORY_TABLE = var.history_table_name
      AGENTS_TABLE            = var.agents_table_name
      AGENT_SKILLS_TABLE      = var.agent_skills_table_name
      BEDROCK_MODEL_ID        = "amazon.nova-micro-v1:0"
      SKILL_EMAIL_LAMBDA_ARN  = var.skill_email_lambda_arn
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "runner" {
  name              = "/aws/lambda/${aws_lambda_function.runner.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_event_rule" "runner_schedule" {
  name                = "${var.name_prefix}-agent-runner-heartbeat"
  description         = "Fires the agent runner every 5 minutes to write heartbeats for all active agents"
  schedule_expression = var.schedule_expression
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "runner_schedule" {
  rule      = aws_cloudwatch_event_rule.runner_schedule.name
  target_id = "agent-runner"
  arn       = aws_lambda_function.runner.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.runner.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.runner_schedule.arn
}
