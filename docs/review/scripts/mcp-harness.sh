#!/usr/bin/env bash
# Usage: mcp-harness.sh <repo-root> <out-dir> <port>
set -euo pipefail
ROOT=$1; OUT=$2; PORT=$3; mkdir -p "$OUT"
DB=$OUT/mcp-$PORT.sqlite; rm -f "$DB" "$DB-wal" "$DB-shm"
cat > "$OUT/mcp-identity.json" <<'J'
{"units":[{"id":"org","name":"Example Org","kind":"organization","parentId":null,"managerId":"owner"},
 {"id":"red","name":"Red Team","kind":"team","parentId":"org","managerId":"owner"},
 {"id":"blue","name":"Blue Team","kind":"team","parentId":"org","managerId":"owner"}],
 "users":[{"id":"owner","name":"Org Owner","unitId":"org"},{"id":"kim","name":"Kim Park","unitId":"red"},{"id":"lee","name":"Lee Wong","unitId":"blue"}]}
J
KIM=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"); LEE=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
HASHES=$(node -e "const c=require('crypto'),h=t=>c.createHash('sha256').update(t).digest('hex');console.log(JSON.stringify({[h('$KIM')]:'kim',[h('$LEE')]:'lee'}))")
ORIGIN=http://127.0.0.1:$PORT
(cd "$ROOT" && CONTEXT_MODE=authenticated HOST=127.0.0.1 PORT=$PORT CONTEXT_DB=$DB CONTEXT_IDENTITY_FILE=$OUT/mcp-identity.json CONTEXT_TOKEN_HASHES=$HASHES CONTEXT_PUBLIC_ORIGIN=$ORIGIN exec node src/server.js > "$OUT/mcp-server-$PORT.log" 2>&1) & PID=$!
trap "kill $PID 2>/dev/null || true" EXIT
for i in $(seq 1 50); do curl -sf $ORIGIN/health >/dev/null && break; sleep 0.1; done
mk() { curl -sf -X POST $ORIGIN/api/knowledge -H "Host: 127.0.0.1:$PORT" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "{\"title\":\"$2\",\"kind\":\"knowledge\",\"content\":\"$3\",\"tags\":[\"zebra\"]}" | node -pe "JSON.parse(require('fs').readFileSync(0)).id"; }
KIM_ITEM=$(mk "$KIM" "Kim private zebra checklist" "Kim only: zebra crossing checklist")
LEE_ITEM=$(mk "$LEE" "Lee private zebra notes" "Lee only: zebra crossing notes")
echo "no-token HTTP status: $(curl -s -o /dev/null -w '%{http_code}' -X POST $ORIGIN/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')"
python3 "$(dirname "$0")/mcp_two_users.py" "$ORIGIN/mcp" "$KIM" "$LEE" "$KIM_ITEM" "$LEE_ITEM" "$OUT/mcp-sdk-$PORT.json"
