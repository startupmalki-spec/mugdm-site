# Email-to-Bill Inbound Webhook

Ops reference for the email-to-bill ingestion endpoint
(`POST /api/bills/inbound-email`).

## Overview

Users forward vendor invoices to a dedicated Mugdm address; an email
provider (Postmark / Mailgun / SendGrid) delivers the message as a JSON
webhook. We upload the PDF/image, run OCR, create a **draft** bill, and
notify the owner in-app.

Draft — never auto-approved. A human must review.

## Address formats accepted

Both styles are parsed by `parseBusinessFromToAddress`:

- `bills+{businessSlug}@mugdm.com` (plus-alias — single MX is enough)
- `bills@{businessSlug}.mugdm.com`  (wildcard subdomain MX)

`businessSlug` is lower-cased, `[a-z0-9][a-z0-9-]{0,62}`. Today we match
it against the name-derived slug of `businesses.name_en` /
`businesses.name_ar`. When a dedicated `slug` column ships, replace the
scan in `route.ts` with an indexed lookup.

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_BILLS` | yes | Must be `true` (global Bills flag). |
| `INBOUND_EMAIL_ENABLED` | yes | Must be `true` to activate the route. |
| `INBOUND_EMAIL_SECRET` | yes | Shared secret; sent by the provider as `X-Inbound-Secret`. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Standard. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Used to write bills/attachments and insert notifications. |

## Provider setup — Postmark (recommended starter)

1. Create a Postmark **Inbound Server**.
2. Add DNS record per Postmark docs:
   - **Plus-alias style:** `MX 10 inbound.postmarkapp.com` on `mugdm.com`.
   - **Subdomain style:** `MX 10 inbound.postmarkapp.com` on
     `*.mugdm.com` (wildcard).
3. Set the inbound webhook URL to:
   `https://app.mugdm.com/api/bills/inbound-email`
4. In the request, add a custom header `X-Inbound-Secret:
   <INBOUND_EMAIL_SECRET>`. If your provider does not support custom
   headers, move the secret into a query parameter and adapt the route.
5. Set **Include raw email content** off (we only need the parsed JSON).

## Provider setup — Mailgun / SendGrid

Mailgun and SendGrid deliver `multipart/form-data`, not JSON. The current
route only speaks Postmark JSON. Add an adapter that transforms their
payload into the shape of `InboundEmailPayload`
(`src/lib/bookkeeper/inbound-email-parser.ts`) before shipping.

Key field mapping (non-exhaustive):

| Postmark | Mailgun | SendGrid |
|---|---|---|
| `From` | `sender` / `From` | `from` |
| `To` | `recipient` / `To` | `to` |
| `Subject` | `subject` | `subject` |
| `Attachments[].Name` | `attachment-1` filename | `attachment1` filename |
| `Attachments[].Content` (base64) | form-data file | form-data file |
| `Attachments[].ContentType` | multipart `Content-Type` | multipart `Content-Type` |

## Testing with curl

```bash
BASE64=$(base64 -w0 sample-invoice.pdf)

curl -X POST https://app.mugdm.com/api/bills/inbound-email \
  -H "Content-Type: application/json" \
  -H "X-Inbound-Secret: $INBOUND_EMAIL_SECRET" \
  -d "{
    \"From\": \"vendor@example.com\",
    \"FromName\": \"Example Co\",
    \"To\": \"bills+acme@mugdm.com\",
    \"Subject\": \"Invoice INV-2026-001\",
    \"Attachments\": [{
      \"Name\": \"invoice.pdf\",
      \"Content\": \"$BASE64\",
      \"ContentType\": \"application/pdf\"
    }]
  }"
```

Expected 200 response:

```json
{
  "ok": true,
  "businessSlug": "acme",
  "attachmentsProcessed": 1,
  "billsCreated": ["<uuid>"],
  "skipped": []
}
```

## Failure modes

| Status | Meaning |
|---|---|
| 401 | `X-Inbound-Secret` missing or wrong. |
| 404 | Feature disabled, or slug did not resolve to a business. |
| 422 | `To` header did not match either accepted format. |
| 200 + `skipped` | Attachment upload or bill insert failed for that file. Retry not automatic. |

## Known gaps

- Only Postmark JSON is native. Mailgun/SendGrid need an adapter.
- `/api/analyze-bill` requires an authenticated user session, so the
  webhook cannot currently reuse its OCR. Drafts fall back to zero
  amounts. Fix: extract the Anthropic extraction logic into
  `src/lib/bookkeeper/bill-ocr.ts` and call it directly.
- Business resolution scans up to 1k businesses — fine for beta, replace
  with an indexed `businesses.slug` column at scale.
- No per-sender spam / allowlist. A future iteration should restrict
  inbound senders to addresses tied to existing vendors for the business.
- Duplicate detection is not implemented — forwarding the same invoice
  twice creates two drafts.
