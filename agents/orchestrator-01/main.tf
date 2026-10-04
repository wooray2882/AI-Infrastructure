terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

# ---------------------------------------------------------------------------
# Package the Lambda
# ---------------------------------------------------------------------------
data "archive_file" "orchestrator" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/orchestrator-01.zip"
}

# ---------------------------------------------------------------------------
# Lambda function — orchestrator-01
# Uses the IAM role created by the agent-heartbeat module.
# That role already has the baseline policy (heartbeat write + registry read)
# plus the specialty lambda_invoke and bedrock policies attached by Terraform.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "orchestrator" {
  function_name    = "${var.name_prefix}-agent-orchestrator-01"
  filename         = data.archive_file.orchestrator.output_path
  source_code_hash = data.archive_file.orchestrator.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = var.agent_role_arn
  timeout          = 30

  environment {
    variables = {
      HEARTBEAT_CURRENT_TABLE = var.current_table_name
      HEARTBEAT_HISTORY_TABLE = var.history_table_name
      AGENT_ID                = "orchestrator-01"
      AGENT_NAME              = "Corelink Orchestrator"
      AGENT_DEPARTMENT        = "core"
    }
  }

  tags = var.tags
}

# CloudWatch log group with a 30-day retention
resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/aws/lambda/${aws_lambda_function.orchestrator.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

# Allow the Lambda role to write CloudWatch logs
resource "aws_iam_role_policy" "orchestrator_logs" {
  name = "${var.name_prefix}-orchestrator-01-logs"
  role = var.agent_role_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}
