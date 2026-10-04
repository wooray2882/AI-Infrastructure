"""
client-onboarding-01 — Client Relations: Onboarding Agent

On each invocation:
1. Uses Claude via Bedrock to generate a personalized onboarding email
2. Sends the email via SES
3. Writes a heartbeat so the dashboard shows it's alive

Environment variables (set by Terraform):
  HEARTBEAT_CURRENT_TABLE  — corelink-agent-heartbeats
  HEARTBEAT_HISTORY_TABLE  — corelink-agent-heartbeats-history
  AGENT_ID                 — client-onboarding-01
  AGENT_NAME               — Client Onboarding Agent
  AGENT_DEPARTMENT         — client-relations
  FROM_EMAIL               — your verified SES email/domain (set in AWS console or Terraform)
  BEDROCK_MODEL_ID         — anthropic.claude-3-haiku-20240307-v1:0
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

CURRENT_TABLE  = os.environ["HEARTBEAT_CURRENT_TABLE"]
HISTORY_TABLE  = os.environ["HEARTBEAT_HISTORY_TABLE"]
AGENT_ID       = os.environ["AGENT_ID"]
AGENT_NAME     = os.environ["AGENT_NAME"]
AGENT_DEPT     = os.environ["AGENT_DEPARTMENT"]
FROM_EMAIL     = os.environ["FROM_EMAIL"]
MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")

dynamodb       = boto3.resource("dynamodb")
current_table  = dynamodb.Table(CURRENT_TABLE)
history_table  = dynamodb.Table(HISTORY_TABLE)
bedrock        = boto3.client("bedrock-runtime")
ses            = boto3.client("ses")


def write_heartbeat(status: str, last_action: str, extra: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "agent_id":       AGENT_ID,
        "agent_name":     AGENT_NAME,
        "department":     AGENT_DEPT,
        "role":           "specialist",
        "status":         status,
        "last_action":    last_action,
        "tools":          "ses bedrock",
        "last_heartbeat": now,
        "timestamp":      now,
    }
    if extra:
        record.update(extra)
    current_table.put_item(Item=record)
    history_table.put_item(Item={**record, "record_id": str(uuid.uuid4())})


def generate_onboarding_email(client_name: str, company: str) -> dict:
    prompt = f"""You are a warm, professional client success agent for Corelink, an AI-powered business operations company.

Write a concise onboarding welcome email for a new client:
- Client name: {client_name}
- Company: {company}

The email should:
1. Welcome them warmly and personally
2. Briefly explain what happens next (intro call, account setup, first check-in)
3. Give them one clear action to take (reply to confirm their preferred meeting time)
4. Be professional but human — not corporate or stiff
5. Be under 200 words

Return ONLY the email body text, no subject line, no headers."""

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"max_new_tokens": 512},
        }),
    )
    result = json.loads(response["body"].read())
    body = result["output"]["message"]["content"][0]["text"]

    subject_prompt = f"Write a short, friendly email subject line (under 10 words) for a welcome/onboarding email to {client_name} at {company}. Return only the subject line, nothing else."
    subject_response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": subject_prompt}]}],
            "inferenceConfig": {"max_new_tokens": 64},
        }),
    )
    subject_result = json.loads(subject_response["body"].read())
    subject = subject_result["output"]["message"]["content"][0]["text"].strip().strip('"')

    return {"subject": subject, "body": body}


def send_email(to_email: str, subject: str, body: str) -> str:
    response = ses.send_email(
        Source=FROM_EMAIL,
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": subject},
            "Body":    {"Text": {"Data": body}},
        },
    )
    return response["MessageId"]


def lambda_handler(event, context):
    print(f"[client-onboarding-01] invoked — event: {json.dumps(event)}")

    write_heartbeat(status="online", last_action="started — preparing onboarding")

    # Client data comes from the event payload; fall back to a demo client
    # so the agent always produces a real output even on scheduled pings.
    client_name = event.get("client_name", "Alex Johnson")
    company     = event.get("company",     "Acme Corp")
    to_email    = event.get("to_email",    FROM_EMAIL)   # send to self if no client email provided

    try:
        # Step 1: generate email content with Claude
        write_heartbeat(status="online", last_action=f"generating onboarding email for {client_name} at {company}")
        email = generate_onboarding_email(client_name, company)
        print(f"[client-onboarding-01] generated email — subject: {email['subject']}")

        # Step 2: send via SES
        message_id = send_email(to_email, email["subject"], email["body"])
        print(f"[client-onboarding-01] email sent — SES message ID: {message_id}")

        write_heartbeat(
            status="online",
            last_action=f"onboarding email sent to {to_email}",
            extra={
                "last_client":    client_name,
                "last_company":   company,
                "ses_message_id": message_id,
            },
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "agent_id":   AGENT_ID,
                "status":     "online",
                "client":     client_name,
                "company":    company,
                "subject":    email["subject"],
                "message_id": message_id,
            }),
        }

    except ClientError as e:
        err = e.response["Error"]
        print(f"[client-onboarding-01] error: {err['Code']}: {err['Message']}")
        write_heartbeat(
            status="error",
            last_action=f"failed: {err['Code']}",
            extra={"error_message": err["Message"]},
        )
        raise
