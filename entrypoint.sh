#!/bin/sh
set -eu

if [ -n "${INFISICAL_CLIENT_ID:-}" ] && [ -n "${INFISICAL_CLIENT_SECRET:-}" ]; then
  INFISICAL_TOKEN=$(infisical login --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain)
  exec infisical run --token="$INFISICAL_TOKEN" \
    --projectId="${INFISICAL_PROJECT_ID:-2296d19c-5f3b-41e1-afa3-fcde39966a71}" \
    --env=qa --path=/ -- env PORT="${PORT:-5180}" NODE_ENV=production "$@"
fi

exec "$@"
