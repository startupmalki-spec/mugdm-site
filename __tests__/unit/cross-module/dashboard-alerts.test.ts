import { describe, it, expect } from 'vitest'
import { generateDashboardAlerts } from '@/lib/cross-module/dashboard-alerts'

const BASE_BUSINESS = { cr_expiry_date: null, contact_phone: '+966500000000', contact_email: 'test@test.com' }

function makeObligation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ob-1',
    type: 'GOSI',
    name: 'GOSI Payment',
    next_due_date: '2026-06-01',
    last_completed_at: null,
    ...overrides,
  }
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    type: 'CR',
    expiry_date: '2027-01-01',
    is_current: true,
    archived_at: null,
    ...overrides,
  }
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    is_reviewed: true,
    ai_confidence: 0.9,
    date: '2026-04-01',
    ...overrides,
  }
}

describe('generateDashboardAlerts', () => {
  it('should return success alert when everything is clear', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [makeDocument()],
      obligations: [makeObligation({ next_due_date: '2026-06-01' })],
      transactions: [makeTransaction()],
    })
    const success = alerts.filter((a) => a.severity === 'success')
    expect(success.length).toBe(1)
    expect(success[0].id).toBe('all-clear')
  })

  it('should flag overdue obligations as critical', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [makeObligation({ id: 'ob-overdue', next_due_date: '2026-03-01', last_completed_at: null })],
      transactions: [],
    })
    const critical = alerts.filter((a) => a.severity === 'critical')
    expect(critical.length).toBeGreaterThanOrEqual(1)
    expect(critical.some((a) => a.id === 'overdue-ob-overdue')).toBe(true)
  })

  it('should flag CR expiry within 30 days as critical', () => {
    const inTwentyDays = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0]
    const alerts = generateDashboardAlerts({
      business: { ...BASE_BUSINESS, cr_expiry_date: inTwentyDays },
      documents: [],
      obligations: [],
      transactions: [],
    })
    const critical = alerts.filter((a) => a.severity === 'critical')
    expect(critical.some((a) => a.id === 'cr-expiring')).toBe(true)
  })

  it('should flag expired documents as critical', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [makeDocument({ id: 'doc-exp', expiry_date: '2025-01-01' })],
      obligations: [],
      transactions: [],
    })
    const critical = alerts.filter((a) => a.severity === 'critical')
    expect(critical.some((a) => a.id === 'doc-expired-doc-exp')).toBe(true)
  })

  it('should flag obligations due within 15 days as warning', () => {
    const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [makeObligation({ id: 'ob-soon', next_due_date: inTenDays })],
      transactions: [],
    })
    const warnings = alerts.filter((a) => a.severity === 'warning')
    expect(warnings.some((a) => a.id === 'due-soon-ob-soon')).toBe(true)
  })

  it('should flag expiring documents as warning', () => {
    const inFifteenDays = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [makeDocument({ id: 'doc-exp-soon', expiry_date: inFifteenDays })],
      obligations: [],
      transactions: [],
    })
    const warnings = alerts.filter((a) => a.severity === 'warning')
    expect(warnings.some((a) => a.id === 'doc-expiring-doc-exp-soon')).toBe(true)
  })

  it('should flag unreviewed low-confidence transactions as warning', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [],
      transactions: [
        makeTransaction({ id: 'tx-ok', is_reviewed: true, ai_confidence: 0.9 }),
        makeTransaction({ id: 'tx-low1', is_reviewed: false, ai_confidence: 0.3 }),
        makeTransaction({ id: 'tx-low2', is_reviewed: false, ai_confidence: 0.5 }),
      ],
    })
    const warnings = alerts.filter((a) => a.severity === 'warning')
    expect(warnings.some((a) => a.id === 'unreviewed-tx')).toBe(true)
  })

  it('should flag low saudization as warning', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [],
      transactions: [],
      teamMembers: [
        { id: 'm1', nationality: 'Indian', status: 'ACTIVE' },
        { id: 'm2', nationality: 'Indian', status: 'ACTIVE' },
        { id: 'm3', nationality: 'Saudi', status: 'ACTIVE' },
      ],
    })
    const warnings = alerts.filter((a) => a.severity === 'warning')
    expect(warnings.some((a) => a.id === 'saudization-low')).toBe(true)
  })

  it('should not flag saudization for 100% Saudi team', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [],
      transactions: [],
      teamMembers: [
        { id: 'm1', nationality: 'Saudi', status: 'ACTIVE' },
        { id: 'm2', nationality: 'Saudi', status: 'ACTIVE' },
      ],
    })
    const warnings = alerts.filter((a) => a.id === 'saudization-low')
    expect(warnings.length).toBe(0)
  })

  it('should flag incomplete profile as info', () => {
    const alerts = generateDashboardAlerts({
      business: { cr_expiry_date: null, contact_phone: null, contact_email: null },
      documents: [],
      obligations: [],
      transactions: [],
    })
    const info = alerts.filter((a) => a.severity === 'info')
    expect(info.some((a) => a.id === 'profile-incomplete')).toBe(true)
  })

  it('should sort critical before warning before info before success', () => {
    const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
    const alerts = generateDashboardAlerts({
      business: { cr_expiry_date: null, contact_phone: null, contact_email: null },
      documents: [makeDocument({ id: 'doc-exp', expiry_date: '2025-01-01' })],
      obligations: [makeObligation({ id: 'ob-soon', next_due_date: inTenDays })],
      transactions: [],
    })
    const severities = alerts.map((a) => a.severity)
    const criticalIdx = severities.indexOf('critical')
    const warningIdx = severities.indexOf('warning')
    const infoIdx = severities.indexOf('info')
    if (criticalIdx >= 0 && warningIdx >= 0) expect(criticalIdx).toBeLessThan(warningIdx)
    if (warningIdx >= 0 && infoIdx >= 0) expect(warningIdx).toBeLessThan(infoIdx)
  })

  it('should not show success alert when there are critical alerts', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [makeDocument({ expiry_date: '2025-01-01' })],
      obligations: [],
      transactions: [],
    })
    const success = alerts.filter((a) => a.severity === 'success')
    expect(success.length).toBe(0)
  })

  it('should include bilingual titles and descriptions', () => {
    const alerts = generateDashboardAlerts({
      business: BASE_BUSINESS,
      documents: [],
      obligations: [],
      transactions: [],
    })
    for (const alert of alerts) {
      expect(alert.title.en).toBeTruthy()
      expect(alert.title.ar).toBeTruthy()
      expect(alert.description.en).toBeTruthy()
      expect(alert.description.ar).toBeTruthy()
    }
  })
})
