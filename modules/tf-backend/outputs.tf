output "bucket_name" {
  description = "S3 bucket name — use this as the 'bucket' value in your backend config."
  value       = aws_s3_bucket.tf_state.bucket
}

output "lock_table_name" {
  description = "DynamoDB lock table name — use this as 'dynamodb_table' in your backend config."
  value       = aws_dynamodb_table.tf_locks.name
}
