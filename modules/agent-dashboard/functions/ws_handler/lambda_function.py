"""
WebSocket connect/disconnect handler.
Stores/removes connectionIds in the connections table so the stream
processor knows who to push updates to.
"""
import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])


def handler(event, context):
    route = event["requestContext"]["routeKey"]
    connection_id = event["requestContext"]["connectionId"]

    if route == "$connect":
        table.put_item(Item={"connectionId": connection_id})
        return {"statusCode": 200}

    if route == "$disconnect":
        table.delete_item(Key={"connectionId": connection_id})
        return {"statusCode": 200}

    return {"statusCode": 200}
