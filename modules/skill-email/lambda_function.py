"""
skill-email — Bedrock Action Group executor

Bedrock calls this Lambda when an inline agent decides to invoke the
send_email action. The Lambda validates the parameters and sends the
email via SES.

Environment variables:
  FROM_EMAIL   — SES-verified sender address
"""

import json
import os

import boto3
from botocore.exceptions import ClientError

FROM_EMAIL = os.environ["FROM_EMAIL"]
ses = boto3.client("ses")


def lambda_handler(event, context):
    print(f"[skill-email] event: {json.dumps(event)}")

    # Bedrock passes the action and parameters in a standard envelope
    action_group = event.get("actionGroup", "")
    action       = event.get("function", "") or event.get("apiPath", "").lstrip("/")
    params       = _extract_params(event)

    if action == "send_email":
        result = _send_email(params)
    else:
        result = {"error": f"Unknown action: {action}"}

    # Bedrock expects the response in this exact shape
    return {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": action_group,
            "apiPath": f"/{action}",
            "httpMethod": "POST",
            "httpStatusCode": 200 if "error" not in result else 400,
            "responseBody": {
                "application/json": {
                    "body": json.dumps(result)
                }
            }
        }
    }


def _extract_params(event: dict) -> dict:
    """Normalize parameters from either requestBody (REST) or parameters (function) style."""
    # REST-style action group
    body = event.get("requestBody", {}).get("content", {}).get("application/json", {}).get("properties", [])
    if body:
        return {p["name"]: p["value"] for p in body}

    # Function-style action group
    params = event.get("parameters", [])
    if params:
        return {p["name"]: p["value"] for p in params}

    return {}


def _send_email(params: dict) -> dict:
    to_email = params.get("to_email", "").strip()
    subject  = params.get("subject", "").strip()
    body     = params.get("body", "").strip()

    if not to_email or not subject or not body:
        return {"error": "Missing required parameter: to_email, subject, or body"}

    try:
        response = ses.send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body":    {"Text": {"Data": body}},
            },
        )
        message_id = response["MessageId"]
        print(f"[skill-email] sent to {to_email} — SES message ID: {message_id}")
        return {"status": "sent", "message_id": message_id}

    except ClientError as e:
        err = e.response["Error"]
        print(f"[skill-email] SES error: {err['Code']}: {err['Message']}")
        return {"error": f"{err['Code']}: {err['Message']}"}
