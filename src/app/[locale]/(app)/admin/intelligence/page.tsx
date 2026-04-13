import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin/allowlist'
import type { Database } from '@/lib/supabase/types'

// Intentionally non-localized strings — this is an internal admin view.
export const dynamic = 'force-dynamic'

interface ProfileRow {
  business_id: string
  user_id: string
  engagement_score: number
  health_score: number
  churn_risk_score: number
  lifecycle_stage: string
  days_since_signup: number
  last_active_at: string | null
  features_used_count: number
}

interface IssueRow {
  id: string
  business_id: string
  issue_type: string
  severity: string
  status: string
  title: string
  source: string
  created_at: string
}

interface AdoptionRow {
  feature_name: string
  adopters: number
}

function serviceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export default async function AdminIntelligencePage() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/dashboard')

  const svc = serviceClient()

  const [profilesRes, issuesRes, adoptionRes] = await Promise.all([
    svc
      .from('user_profiles')
      .select(
        'business_id, user_id, engagement_score, health_score, churn_risk_score, lifecycle_stage, days_since_signup, last_active_at, features_used_count'
      )
      .order('churn_risk_score', { ascending: false })
      .limit(100),
    svc
      .from('detected_issues')
      .select('id, business_id, issue_type, severity, status, title, source, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    svc.from('feature_adoption').select('feature_name, business_id'),
  ])

  const profiles = (profilesRes.data as unknown as ProfileRow[]) ?? []
  const issues = (issuesRes.data as unknown as IssueRow[]) ?? []

  const adoptionMap = new Map<string, Set<string>>()
  for (const row of (adoptionRes.data as unknown as { feature_name: string; business_id: string }[]) ?? []) {
    if (!adoptionMap.has(row.feature_name)) adoptionMap.set(row.feature_name, new Set())
    adoptionMap.get(row.feature_name)!.add(row.business_id)
  }
  const adoption: AdoptionRow[] = Array.from(adoptionMap.entries())
    .map(([feature_name, set]) => ({ feature_name, adopters: set.size }))
    .sort((a, b) => b.adopters - a.adopters)

  return (
    <div className="space-y-10 p-6 text-sm">
      <header>
        <h1 className="text-2xl font-semibold">Intelligence — Admin</h1>
        <p className="text-muted-foreground">Internal view. Sorted by churn risk.</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">User health (top 100 by churn risk)</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-2">Business</th>
                <th className="p-2">Stage</th>
                <th className="p-2">Engage</th>
                <th className="p-2">Health</th>
                <th className="p-2">Churn</th>
                <th className="p-2">Days since signup</th>
                <th className="p-2">Features</th>
                <th className="p-2">Last active</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.business_id} className="border-t border-border">
                  <td className="p-2 font-mono">{p.business_id.slice(0, 8)}</td>
                  <td className="p-2">{p.lifecycle_stage}</td>
                  <td className="p-2">{p.engagement_score}</td>
                  <td className="p-2">{p.health_score}</td>
                  <td className="p-2 text-red-400">{p.churn_risk_score}</td>
                  <td className="p-2">{p.days_since_signup}</td>
                  <td className="p-2">{p.features_used_count}</td>
                  <td className="p-2">{p.last_active_at ? new Date(p.last_active_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td className="p-3 text-muted-foreground" colSpan={8}>No profiles computed yet. Trigger compute-profiles.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent detected issues</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Type</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Status</th>
                <th className="p-2">Source</th>
                <th className="p-2">Title</th>
                <th className="p-2">Business</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="p-2">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="p-2">{i.issue_type}</td>
                  <td className="p-2">{i.severity}</td>
                  <td className="p-2">{i.status}</td>
                  <td className="p-2">{i.source}</td>
                  <td className="p-2">{i.title}</td>
                  <td className="p-2 font-mono">{i.business_id.slice(0, 8)}</td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr><td className="p-3 text-muted-foreground" colSpan={7}>No issues detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Feature adoption</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-2">Feature</th>
                <th className="p-2">Businesses adopting</th>
              </tr>
            </thead>
            <tbody>
              {adoption.map((a) => (
                <tr key={a.feature_name} className="border-t border-border">
                  <td className="p-2">{a.feature_name}</td>
                  <td className="p-2">{a.adopters}</td>
                </tr>
              ))}
              {adoption.length === 0 && (
                <tr><td className="p-3 text-muted-foreground" colSpan={2}>No adoption data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
