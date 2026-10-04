terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# Lambda — action group executor
# Bedrock calls this when an inline agent invokes the send_email action.
# ---------------------------------------------------------------------------
data "archive_file" "skill_email" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/skill-email.zip"
}

resource "aws_iam_role" "skill_email" {
  name = "${var.name_prefix}-skill-email"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      },
      # Bedrock must also be able to invoke this Lambda as an action group executor
      {
        Effect    = "Allow"
        Principal = { Service = "bedrock.amazonaws.com" }
        Action    = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "skill_email_ses" {
  name = "${var.name_prefix}-skill-email-ses"
  role = aws_iam_role.skill_email.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "skill_email" {
  function_name    = "${var.name_prefix}-skill-email"
  filename         = data.archive_file.skill_email.output_path
  source_code_hash = data.archive_file.skill_email.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.skill_email.arn
  timeout          = 30

  environment {
    variables = {
      FROM_EMAIL = var.from_email
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "skill_email" {
  name              = "/aws/lambda/${aws_lambda_function.skill_email.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

# Allow Bedrock (inline agents) to invoke this Lambda as an action group
resource "aws_lambda_permission" "bedrock" {
  statement_id  = "AllowBedrockInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.skill_email.function_name
  principal     = "bedrock.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}
