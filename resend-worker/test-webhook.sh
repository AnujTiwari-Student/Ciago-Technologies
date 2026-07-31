#!/bin/bash
# Test webhook endpoint

WORKER_URL="https://resend-worker.anujavengers.workers.dev"

echo "Testing health check..."
curl -s "$WORKER_URL/health"

echo -e "\n\nTesting webhook with sample payload..."
curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.delivered",
    "data": {
      "email_id": "test-resend-id-123",
      "created_at": "2026-07-31T12:00:00Z"
    }
  }'

echo -e "\n\nDone!"
