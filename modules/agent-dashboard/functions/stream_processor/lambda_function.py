"""
DynamoDB stream processor.
Triggered when any agent writes a heartbeat to the current-state table.
Reads all active WebSocket connections and pushes the updated agent record
to every connected dashboard client.
"""
import json
import os
import boto3
from boto3.dynamodb.types import TypeDeserializer

dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])
deserializer = TypeDeserializer()


def deserialize(item):
    return {k: deserializer.deserialize(v) for k, v in item.items()}


def handler(event, context):
    endpoint = os.environ["WEBSOCKET_ENDPOINT"]
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint)

    # Collect all changed agent records from the stream batch
    updates = []
    for record in event["Records"]:
        if record["eventName"] not in ("INSERT", "MODIFY"):
            continue
        new_image = record["dynamodb"].get("NewImage", {})
        if new_image:
            updates.append(deserialize(new_image))

    if not updates:
        return

    payload = json.dumps({"type": "heartbeat_update", "agents": updates}).encode()

    # Broadcast to all connected clients
    connections = connections_table.scan(ProjectionExpression="connectionId")["Items"]
    stale = []
    for conn in connections:
        cid = conn["connectionId"]
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            stale.append(cid)

    # Clean up stale connections
    for cid in stale:
        connections_table.delete_item(Key={"connectionId": cid})
