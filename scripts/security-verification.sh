#!/usr/bin/env bash
# Manual verification for the security hardening on this branch.
# Run against a local `npm run dev` instance with APP_AUTH_ENABLED=true and
# ADMIN_EMAILS set. Replace HOST and the cookie jar paths as needed.
#
# Usage:
#   HOST=http://localhost:3000 ./scripts/security-verification.sh
#
# Expected results are commented inline. The script does not push to any
# remote and does not modify production data.

set -euo pipefail

HOST="${HOST:-http://localhost:3000}"
ANON_COOKIES="${ANON_COOKIES:-/tmp/audgen-anon.cookies}"
USER_COOKIES="${USER_COOKIES:-/tmp/audgen-user.cookies}"
ADMIN_COOKIES="${ADMIN_COOKIES:-/tmp/audgen-admin.cookies}"

rule() { printf "\n=== %s ===\n" "$*"; }
expect() { printf "  expect: %s\n" "$*"; }

rule "Unauthenticated -> /admin must NOT be 200"
expect "redirect to /login (307) or 404"
curl -s -o /dev/null -w "  status=%{http_code} redirect=%{redirect_url}\n" "$HOST/admin"

rule "Unauthenticated -> /admin/health must NOT be 200"
expect "redirect to /login (307) or 404"
curl -s -o /dev/null -w "  status=%{http_code} redirect=%{redirect_url}\n" "$HOST/admin/health"

rule "Normal signed-in user (NOT in ADMIN_EMAILS) -> /admin must 404"
expect "404"
if [ -f "$USER_COOKIES" ]; then
  curl -s -b "$USER_COOKIES" -o /dev/null -w "  status=%{http_code}\n" "$HOST/admin"
else
  echo "  (skip: $USER_COOKIES not present; log in first as a non-admin)"
fi

rule "Admin user (email in ADMIN_EMAILS) -> /admin must 200"
expect "200"
if [ -f "$ADMIN_COOKIES" ]; then
  curl -s -b "$ADMIN_COOKIES" -o /dev/null -w "  status=%{http_code}\n" "$HOST/admin"
else
  echo "  (skip: $ADMIN_COOKIES not present; log in first as an admin allowlisted email)"
fi

rule "list-sessions must not contain raw token field"
expect "absence of \"token\":\"...\" in the response body"
if [ -f "$USER_COOKIES" ]; then
  body=$(curl -s -b "$USER_COOKIES" "$HOST/api/auth/list-sessions")
  if printf "%s" "$body" | grep -E '"token"\s*:\s*"' >/dev/null; then
    echo "  FAIL: token field present"
  else
    echo "  PASS: no token field"
  fi
fi

rule "get-session must not contain raw token field"
expect "absence of session.token in the response body"
if [ -f "$USER_COOKIES" ]; then
  body=$(curl -s -b "$USER_COOKIES" "$HOST/api/auth/get-session")
  if printf "%s" "$body" | grep -E '"token"\s*:\s*"' >/dev/null; then
    echo "  FAIL: token field present"
  else
    echo "  PASS: no token field"
  fi
fi

rule "import-jobs POST without auth must NOT be 200"
expect "401/404 or middleware redirect, never 200"
curl -s -o /dev/null -w "  status=%{http_code} redirect=%{redirect_url}\n" \
  -X POST "$HOST/api/import-jobs" -H 'content-type: application/json' -d '{}'

rule "import-jobs POST with auth but wrong-shape body must 400"
expect "400 with 'Invalid body' error"
if [ -f "$USER_COOKIES" ]; then
  curl -s -b "$USER_COOKIES" -X POST "$HOST/api/import-jobs" \
    -H "Origin: $HOST" -H 'content-type: application/json' -d '{"workspaceId":"deadbeef"}' \
    -w "\n  status=%{http_code}\n"
fi

rule "import-jobs POST without same-origin / Origin header must 403"
expect "403 cross-site request blocked"
if [ -f "$USER_COOKIES" ]; then
  curl -s -b "$USER_COOKIES" -X POST "$HOST/api/import-jobs" \
    -H 'content-type: application/json' -d '{}' \
    -H 'Sec-Fetch-Site: cross-site' \
    -w "  status=%{http_code}\n"
fi

rule "Security headers present on /"
expect "CSP, Referrer-Policy, Permissions-Policy, X-Frame-Options, COOP, CORP, HSTS, nosniff"
curl -sI "$HOST/" | grep -iE \
  '^(content-security-policy|referrer-policy|permissions-policy|x-frame-options|cross-origin-opener-policy|cross-origin-resource-policy|strict-transport-security|x-content-type-options):'

echo
echo "Done. Review the output above. None of these requests modify production data."
