/**
 * Admin allowlist. Reads ADMIN_EMAILS from the environment — a
 * comma-separated list of email addresses. Case-insensitive match.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS ?? ''
  if (!raw.trim()) return false
  const allow = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(email.toLowerCase())
}
