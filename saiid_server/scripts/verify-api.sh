#!/bin/bash
# System inspection script: health, OPTIONS (CORS), and optional GET/PATCH with token.
# Usage:
#   ./scripts/verify-api.sh
#   BASE_URL=http://localhost:8000/api ./scripts/verify-api.sh
#   TOKEN=your_bearer_token PROJECT_ID=1 ./scripts/verify-api.sh
#
# Set BASE_URL, TOKEN, PROJECT_ID as needed. PROJECT_ID is used only for PATCH tests.

BASE_URL="${BASE_URL:-https://forms-api.saiid.org/api}"
ORIGIN="${ORIGIN:-https://forms.saiid.org}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local cond="$2"
  if eval "$cond"; then
    echo "[PASS] $name"
    ((PASS++)) || true
    return 0
  else
    echo "[FAIL] $name"
    ((FAIL++)) || true
    return 1
  fi
}

echo "Base URL: $BASE_URL"
echo "Origin:   $ORIGIN"
echo ""

# 1. GET health
CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "$BASE_URL/health")
check "GET /health returns 200" "[ \"$CODE\" = \"200\" ]"
if [ -f /tmp/health.json ]; then
  check "GET /health body has status ok" "grep -q '\"status\":\"ok\"' /tmp/health.json"
  check "GET /health body has database" "grep -q '\"database\"' /tmp/health.json"
fi
echo ""

# 2. OPTIONS login (POST)
OPT_RES=$(curl -s -I -X OPTIONS "$BASE_URL/login" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization")
OPT_CODE=$(echo "$OPT_RES" | head -1)
check "OPTIONS /login returns 204" "echo \"$OPT_CODE\" | grep -q 204"
check "OPTIONS /login has Allow-Origin" "echo \"$OPT_RES\" | grep -qi 'Access-Control-Allow-Origin'"
check "OPTIONS /login has Allow-Methods" "echo \"$OPT_RES\" | grep -qi 'Access-Control-Allow-Methods'"
echo ""

# 3. OPTIONS project-proposals/1 (PATCH)
OPT2_RES=$(curl -s -I -X OPTIONS "$BASE_URL/project-proposals/1" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization")
OPT2_CODE=$(echo "$OPT2_RES" | head -1)
check "OPTIONS /project-proposals/1 returns 204" "echo \"$OPT2_CODE\" | grep -q 204"
check "OPTIONS /project-proposals/1 has PATCH in Allow-Methods" "echo \"$OPT2_RES\" | grep -qi 'PATCH'"
echo ""

# 4. GET project-proposals without token -> 401
CODE401=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/project-proposals")
check "GET /project-proposals without token returns 401" "[ \"$CODE401\" = \"401\" ]"
echo ""

# 5. Optional: with TOKEN, GET project-proposals
if [ -n "$TOKEN" ]; then
  CODE_AUTH=$(curl -s -o /tmp/pp.json -w "%{http_code}" "$BASE_URL/project-proposals" -H "Authorization: Bearer $TOKEN")
  check "GET /project-proposals with token returns 200 or 403" "[ \"$CODE_AUTH\" = \"200\" ] || [ \"$CODE_AUTH\" = \"403\" ]"
  echo ""

  # 6. Optional: PATCH project-proposals/{id}
  if [ -n "$PROJECT_ID" ]; then
    PATCH_CODE=$(curl -s -o /tmp/patch.json -w "%{http_code}" -X PATCH "$BASE_URL/project-proposals/$PROJECT_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Origin: $ORIGIN" \
      -d '{}')
    check "PATCH /project-proposals/$PROJECT_ID returns 200/422/403 (not 405)" "[ \"$PATCH_CODE\" = \"200\" ] || [ \"$PATCH_CODE\" = \"422\" ] || [ \"$PATCH_CODE\" = \"403\" ] || [ \"$PATCH_CODE\" = \"401\" ]"
  fi
else
  echo "Set TOKEN (and optionally PROJECT_ID) to run authenticated and PATCH checks."
fi

echo ""
echo "--- Summary: $PASS passed, $FAIL failed ---"
[ "$FAIL" -eq 0 ]
