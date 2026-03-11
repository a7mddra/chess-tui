#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sanitize-fixture.sh <path-to-html-fixture>

Example:
  scripts/sanitize-fixture.sh tests/fixtures/chesscom/play-online.2026-03-11.html
EOF
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

target_file="$1"
if [[ ! -f "$target_file" ]]; then
  echo "File not found: $target_file" >&2
  exit 1
fi

tmp_backup="$(mktemp)"
cp "$target_file" "$tmp_backup"

restore_on_error() {
  cp "$tmp_backup" "$target_file"
  rm -f "$tmp_backup"
  echo "Sanitize failed. Original file restored." >&2
}

cleanup() {
  rm -f "$tmp_backup"
}

trap restore_on_error ERR

perl -0777 -i -pe '
  # Username placeholders used by existing tests/docs.
  s/\ba7mddra\b/user_one/g;
  s/\bmorony2\b/user_two/g;

  # Common personal/contact data.
  s/[A-Za-z0-9._%+-]+\@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/fixture\@example.com/g;
  s/\b(?:\d{1,3}\.){3}\d{1,3}\b/0.0.0.0/g;

  # Session/auth/payment fields found in page payloads.
  s/(name="_csrf_token" value=")[^"]*"/${1}REDACTED_CSRF_TOKEN"/g;
  s/"intercomUserJwt":"[^"]*"/"intercomUserJwt":"REDACTED_INTERCOM_JWT"/g;
  s/"intercom_user_jwt":"[^"]*"/"intercom_user_jwt":"REDACTED_INTERCOM_JWT"/g;
  s/"csrf"\s*:\s*\{[^}]*\}/"csrf":{"token":"REDACTED_CSRF_TOKEN","login":"REDACTED_CSRF_LOGIN","logout":"REDACTED_CSRF_LOGOUT"}/g;
  s/"liveramp":\{"api_key":"[^"]*"\}/"liveramp":{"api_key":"REDACTED_API_KEY"}/g;
  s/"paypalClientId":"[^"]*"/"paypalClientId":"REDACTED_PAYPAL_CLIENT_ID"/g;
  s/"adyen":\{"environment":"([^"]*)","clientKey":"[^"]*","key":"[^"]*","merchant":"([^"]*)","originKey":"[^"]*"/"adyen":{"environment":"$1","clientKey":"REDACTED_ADYEN_CLIENT_KEY","key":"REDACTED_ADYEN_KEY","merchant":"$2","originKey":"REDACTED_ADYEN_ORIGIN_KEY"/g;

  # Stable IDs and identifiers.
  s#https://www\.chess\.com/game/\d+#https://www.chess.com/game/000000000000#g;
  s#https://images\.chesscomfiles\.com/uploads/v1/user/\d+#https://images.chesscomfiles.com/uploads/v1/user/100000002#g;
  s/"uuid":"[^"]*"/"uuid":"REDACTED_UUID"/g;
  s/"bucketingId":"[^"]*"/"bucketingId":"REDACTED_BUCKETING_ID"/g;
  s/"user_id":"[^"]*"/"user_id":"REDACTED_USER_ID"/g;
  s/"ChessCom UID":[0-9]+/"ChessCom UID":100000001/g;
  s/"ChessCom User UUID":"[^"]*"/"ChessCom User UUID":"REDACTED_USER_UUID"/g;

  # Human name fields.
  s/"firstName":"[^"]*"/"firstName":"fixture"/g;
  s/"lastName":"[^"]*"/"lastName":"user"/g;
  s/"First Name":"[^"]*"/"First Name":"Fixture"/g;
  s/"Last Name":"[^"]*"/"Last Name":"User"/g;

  # Tracking URL params.
  s/duid=[^&"]+/duid=REDACTED_DUID/g;
  s/pv=[^&"]+/pv=REDACTED_PV/g;
' "$target_file"

trap - ERR
cleanup

echo "Sanitized fixture: $target_file"
