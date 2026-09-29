terraform {
  required_providers {
    aws  = { source = "hashicorp/aws", version = ">= 5.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.0" }
  }
}

# ---------------------------------------------------------------------------
# Connections table — tracks active WebSocket clients
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "connections" {
  name         = "${var.name_prefix}-ws-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(var.tags, { TablePurpose = "websocket-connections" })
}

# ---------------------------------------------------------------------------
# Lambda — WebSocket connect / disconnect
# ---------------------------------------------------------------------------
data "archive_file" "ws_handler" {
  type        = "zip"
  source_file = "${path.module}/functions/ws_handler/lambda_function.py"
  output_path = "${path.module}/functions/ws_handler.zip"
}

resource "aws_lambda_function" "ws_handler" {
  function_name    = "${var.name_prefix}-ws-handler"
  filename         = data.archive_file.ws_handler.output_path
  source_code_hash = data.archive_file.ws_handler.output_base64sha256
  handler          = "lambda_function.handler"
  runtime          = "python3.12"
  role             = aws_iam_role.ws_handler.arn
  timeout          = 10

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }

  tags = var.tags
}

resource "aws_iam_role" "ws_handler" {
  name = "${var.name_prefix}-ws-handler-role"

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

resource "aws_iam_role_policy" "ws_handler" {
  role = aws_iam_role.ws_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# Lambda — DynamoDB stream → WebSocket broadcast
# ---------------------------------------------------------------------------
data "archive_file" "stream_processor" {
  type        = "zip"
  source_file = "${path.module}/functions/stream_processor/lambda_function.py"
  output_path = "${path.module}/functions/stream_processor.zip"
}

resource "aws_lambda_function" "stream_processor" {
  function_name    = "${var.name_prefix}-stream-processor"
  filename         = data.archive_file.stream_processor.output_path
  source_code_hash = data.archive_file.stream_processor.output_base64sha256
  handler          = "lambda_function.handler"
  runtime          = "python3.12"
  role             = aws_iam_role.stream_processor.arn
  timeout          = 30

  environment {
    variables = {
      CONNECTIONS_TABLE  = aws_dynamodb_table.connections.name
      WEBSOCKET_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
    }
  }

  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "stream" {
  event_source_arn  = var.heartbeat_stream_arn
  function_name     = aws_lambda_function.stream_processor.arn
  starting_position = "LATEST"
  batch_size        = 10
}

resource "aws_iam_role" "stream_processor" {
  name = "${var.name_prefix}-stream-processor-role"

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

resource "aws_iam_role_policy" "stream_processor" {
  role = aws_iam_role.stream_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
        ]
        Resource = var.heartbeat_stream_arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan"]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan"]
        Resource = var.heartbeat_current_table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "${aws_apigatewayv2_api.ws.execution_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# API Gateway WebSocket
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "ws" {
  name                       = "${var.name_prefix}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "ws_handler" {
  api_id                    = aws_apigatewayv2_api.ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.ws_handler.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_stage" "ws" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = "prod"
  auto_deploy = true

  tags = var.tags
}

resource "aws_lambda_permission" "ws_handler" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------
# S3 — React app hosting (private, served only via CloudFront)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "dashboard" {
  bucket = "${var.name_prefix}-dashboard-${data.aws_caller_identity.current.account_id}"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket                  = aws_s3_bucket.dashboard.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_policy" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.dashboard.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.dashboard.arn
        }
      }
    }]
  })
}

# ---------------------------------------------------------------------------
# CloudFront — serves the React app from S3
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "dashboard" {
  name                              = "${var.name_prefix}-dashboard-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "Corelink agent dashboard"

  origin {
    domain_name              = aws_s3_bucket.dashboard.bucket_regional_domain_name
    origin_id                = "s3-dashboard"
    origin_access_control_id = aws_cloudfront_origin_access_control.dashboard.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-dashboard"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # SPA fallback — send all 404s to index.html so React Router handles routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.tags
}
