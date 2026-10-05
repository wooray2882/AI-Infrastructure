terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

data "archive_file" "api" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/agent-api.zip"
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------
resource "aws_iam_role" "api" {
  name = "${var.name_prefix}-agent-api"

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

resource "aws_iam_role_policy" "api" {
  name = "${var.name_prefix}-agent-api-policy"
  role = aws_iam_role.api.id

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
        Sid    = "AgentsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem",
          "dynamodb:Scan", "dynamodb:Query", "dynamodb:UpdateItem",
        ]
        Resource = [var.agents_table_arn]
      },
      {
        Sid    = "SkillsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem",
          "dynamodb:Query",
        ]
        Resource = [var.agent_skills_table_arn]
      },
      {
        Sid      = "HeartbeatDelete"
        Effect   = "Allow"
        Action   = ["dynamodb:DeleteItem"]
        Resource = [var.heartbeat_current_table_arn]
      },
      {
        Sid    = "OrgsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem",
          "dynamodb:Scan", "dynamodb:Query",
        ]
        Resource = [var.organizations_table_arn]
      },
      {
        Sid    = "DeptsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem",
          "dynamodb:Scan", "dynamodb:Query",
        ]
        Resource = [
          var.departments_table_arn,
          "${var.departments_table_arn}/index/*",
        ]
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "api" {
  function_name    = "${var.name_prefix}-agent-api"
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.api.arn
  timeout          = 30

  environment {
    variables = {
      AGENTS_TABLE       = var.agents_table_name
      AGENT_SKILLS_TABLE = var.agent_skills_table_name
      HEARTBEAT_TABLE    = var.heartbeat_current_table_name
      ORGS_TABLE         = var.organizations_table_name
      DEPTS_TABLE        = var.departments_table_name
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 30
  tags              = var.tags
}

# ---------------------------------------------------------------------------
# HTTP API Gateway v2
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.name_prefix}-agent-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "catch_all" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  tags = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
