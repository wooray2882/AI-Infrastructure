terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# GitHub OIDC provider — allows GitHub Actions to assume AWS roles without
# static credentials. One provider per AWS account (idempotent).
# ---------------------------------------------------------------------------
data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = var.tags
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

# ---------------------------------------------------------------------------
# IAM role — assumed by GitHub Actions for the AI-Infrastructure repo
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    # Scope to this specific repo and branch — prevents other repos from
    # assuming this role even if they share the same GitHub OIDC provider
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.assume_role.json

  tags = merge(var.tags, {
    Purpose   = "github-actions-oidc"
    GitHubRepo = var.github_repo
  })
}

# ---------------------------------------------------------------------------
# Policy — scoped to only what Terraform needs for this project:
# S3 state, DynamoDB locks, and the heartbeat resources
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "terraform_permissions" {
  # Terraform state bucket
  statement {
    sid    = "TerraformStateBucket"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetBucketVersioning",
      "s3:PutBucketVersioning",
      "s3:GetEncryptionConfiguration",
      "s3:PutEncryptionConfiguration",
      "s3:GetBucketPublicAccessBlock",
      "s3:PutBucketPublicAccessBlock",
      "s3:CreateBucket",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}",
      "arn:aws:s3:::${var.state_bucket_name}/*",
    ]
  }

  # Terraform state locking
  statement {
    sid    = "TerraformStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
      "dynamodb:CreateTable",
      "dynamodb:TagResource",
    ]
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.lock_table_name}",
    ]
  }

  # Heartbeat DynamoDB tables
  statement {
    sid    = "HeartbeatDynamoDBTables"
    effect = "Allow"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:UpdateTable",
      "dynamodb:DeleteTable",
      "dynamodb:DescribeTable",
      "dynamodb:DescribeTimeToLive",
      "dynamodb:UpdateTimeToLive",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:UpdateContinuousBackups",
      "dynamodb:ListTagsOfResource",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
    ]
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/corelink-agent-heartbeats",
      "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/corelink-agent-heartbeats-history",
      "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/corelink-ai-tf-locks",
    ]
  }

  # IAM — manage agent roles and policies for the heartbeat module
  statement {
    sid    = "HeartbeatIAM"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:UpdateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PassRole",
      "iam:CreatePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:TagPolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListRolePolicies",
      "iam:GetRolePolicy",
    ]
    resources = [
      "arn:aws:iam::${var.aws_account_id}:role/corelink-*",
      "arn:aws:iam::${var.aws_account_id}:policy/corelink-*",
    ]
  }
}

resource "aws_iam_policy" "terraform_permissions" {
  name        = "${var.role_name}-policy"
  description = "Terraform permissions for AI-Infrastructure GitHub Actions"
  policy      = data.aws_iam_policy_document.terraform_permissions.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "terraform_permissions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.terraform_permissions.arn
}
