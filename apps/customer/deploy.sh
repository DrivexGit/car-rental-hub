#!/usr/bin/env bash
# Production deploy to Kamyar's Vercel (project drivex-customer). All values come from .env.local.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env.local; set +a
args=()
for k in AI_BASE_URL AI_API_KEY AI_MODEL STAFF_WEBHOOK_URL STAFF_WEBHOOK_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
         VITE_SUPABASE_ANON_KEY TENANT_ID AUTH_SECRET OTP_TEST_CODE ZIINA_API_KEY ZIINA_TEST_MODE PUSH_HOOK_SECRET VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT PANEL_URL; do
  [ -n "${!k:-}" ] && args+=(-e "$k=${!k}")
done
for k in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_SUPPORT_PHONE VITE_WHATSAPP_NUMBER VITE_VAPID_PUBLIC_KEY; do
  [ -n "${!k:-}" ] && args+=(-b "$k=${!k}")
done
NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem npx -y vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" --name drivex-customer "${args[@]}"
