#!/usr/bin/env bash
# Simulates a real user upgrading an existing self-hosted install: builds the
# OLD_TAG image, runs it against a fresh data volume and seeds it with real
# data (a user, a tag), stops it, then starts the CURRENT source's image
# against that *same* volume, same as swapping the image tag in an existing
# docker-compose.yml and restarting. Verifies the new version actually boots
# against old data and that the two documented upgrade-time behavior changes
# (see CHANGELOG.md) happen the way they're supposed to:
#   - the one-time forced logout when the sessions table gets its `id`
#     column (db.ts) actually invalidates old sessions
#   - the account/data itself (password, tags) survives intact
#
# Same idea as the "two Docker images, one shared volume" pattern described
# at https://zach.codes/p/testing-migrations-before-releasing, adapted for
# recoral's runtime ensureColumn() migrations instead of versioned migration
# files (recoral doesn't have those, see db.ts).
set -euo pipefail
cd "$(dirname "$0")"

OLD_TAG="${1:-v0.2.0}"
PORT=7246
BASE_URL="http://localhost:$PORT"
TESTDIR=$(mktemp -d /tmp/recoral-upgrade-test.XXXXXX)
WORKTREE=$(mktemp -d /tmp/recoral-upgrade-old-src.XXXXXX)
FAILED=0

cleanup() {
	docker rm -f recoral-upgrade-old recoral-upgrade-new >/dev/null 2>&1 || true
	git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

check() {
	# check <label> <actual> <expected>
	if [ "$2" = "$3" ]; then
		echo "  PASS: $1"
	else
		echo "  FAIL: $1 (got '$2', expected '$3')"
		FAILED=1
	fi
}

wait_healthy() {
	for _ in $(seq 1 30); do
		if curl -sf "$BASE_URL/api/health" >/dev/null 2>&1; then return 0; fi
		sleep 1
	done
	echo "Server never became healthy at $BASE_URL" >&2
	exit 1
}

echo "== Building OLD ($OLD_TAG) image =="
git worktree add --detach "$WORKTREE" "$OLD_TAG" >/dev/null
docker build -q -t recoral-upgrade-test:old "$WORKTREE" >/dev/null

echo "== Building CURRENT image =="
docker build -q -t recoral-upgrade-test:new . >/dev/null

echo "== Starting OLD image against a fresh volume ($TESTDIR/data) =="
docker run -d --name recoral-upgrade-old -p "$PORT:7245" \
	-e PORT=7245 -e DATA_DIR=/data \
	-v "$TESTDIR/data:/data" recoral-upgrade-test:old >/dev/null
wait_healthy

echo "== Seeding real data on the old version =="
REGISTER_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/auth/register" \
	-H "Content-Type: application/json" \
	-d '{"username":"upgradetest","password":"UpgradeTest123!"}')
OLD_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$OLD_TOKEN" ]; then
	echo "Registration against the old image failed, got: $REGISTER_RESPONSE" >&2
	exit 1
fi
curl -sf -X POST "$BASE_URL/api/tags" \
	-H "Content-Type: application/json" -H "Authorization: Bearer $OLD_TOKEN" \
	-d '{"name":"upgrade-test-tag","hue":180}' >/dev/null

echo "== Stopping OLD, starting NEW against the same volume =="
docker stop recoral-upgrade-old >/dev/null
docker run -d --name recoral-upgrade-new -p "$PORT:7245" \
	-e PORT=7245 -e DATA_DIR=/data \
	-v "$TESTDIR/data:/data" recoral-upgrade-test:new >/dev/null
wait_healthy

echo "== Verifying =="
NEW_HEALTH=$(curl -sf "$BASE_URL/api/health" | grep -o '"status":"[^"]*"')
check "new version boots against old data" "$NEW_HEALTH" '"status":"ok"'

OLD_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me" -H "Authorization: Bearer $OLD_TOKEN")
check "old session was force-invalidated on upgrade" "$OLD_TOKEN_STATUS" "401"

LOGIN_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
	-H "Content-Type: application/json" \
	-d '{"identifier":"upgradetest","password":"UpgradeTest123!"}')
NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
check "same password still logs in after upgrade" "$([ -n "$NEW_TOKEN" ] && echo yes || echo no)" "yes"

TAGS_RESPONSE=$(curl -sf "$BASE_URL/api/tags" -H "Authorization: Bearer $NEW_TOKEN")
check "pre-upgrade tag data survived" "$(echo "$TAGS_RESPONSE" | grep -c "upgrade-test-tag")" "1"

echo ""
# The containers write these as their own internal user, not the host user
# running this script, so a plain host-side rm -rf hits Permission denied.
docker run --rm -v "$TESTDIR:/cleanup" alpine rm -rf /cleanup/data >/dev/null 2>&1 || true
rmdir "$TESTDIR" 2>/dev/null || true
if [ "$FAILED" -eq 0 ]; then
	echo "All upgrade checks passed ($OLD_TAG -> current)."
else
	echo "One or more upgrade checks FAILED, see above." >&2
	exit 1
fi
