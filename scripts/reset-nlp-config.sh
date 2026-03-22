#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Reset NLP config to production defaults
#  Usage: ./scripts/reset-nlp-config.sh [jwt-token]
#
#  If no token provided, logs in with admin/admin to get one.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"

# Get or use provided JWT token
if [[ -n "${1:-}" ]]; then
    TOKEN="$1"
else
    echo "Logging in as admin..."
    TOKEN=$(curl -sf "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin"}' | \
        python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null) || {
        echo "ERROR: Could not login. Pass JWT token as argument: $0 <token>"
        exit 1
    }
fi

echo "Resetting NLP config to production defaults..."
RESPONSE=$(curl -sf -X PUT "$API_URL/api/nlp/config" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "confidenceThreshold": 0.75,
        "localTimeoutMs": 10000,
        "maxTimeoutMs": 30000,
        "localModelName": "llama3:8b",
        "embeddingModel": "mxbai-embed-large"
    }')

echo "Done. Current config:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
