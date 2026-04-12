import type { TransactionCategory } from '@/lib/supabase/types'

const STORAGE_KEY = 'mugdm_category_corrections'

interface CategoryCorrection {
  vendor: string
  originalCategory: TransactionCategory
  correctedCategory: TransactionCategory
  count: number
  lastUpdated: string
}

function normalizeVendor(vendor: string): string {
  return vendor.trim().toLowerCase()
}

function loadCorrections(): CategoryCorrection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CategoryCorrection[]) : []
  } catch {
    return []
  }
}

function saveCorrections(corrections: CategoryCorrection[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Record a user's category correction for a vendor.
 * When the same vendor is corrected to the same category multiple times,
 * the count is incremented to build confidence.
 */
export function recordCategoryCorrection(
  vendor: string,
  originalCategory: TransactionCategory,
  correctedCategory: TransactionCategory
): void {
  if (!vendor.trim() || originalCategory === correctedCategory) return

  const corrections = loadCorrections()
  const key = normalizeVendor(vendor)

  const existing = corrections.find(
    (c) => normalizeVendor(c.vendor) === key && c.correctedCategory === correctedCategory
  )

  if (existing) {
    existing.count += 1
    existing.originalCategory = originalCategory
    existing.lastUpdated = new Date().toISOString()
  } else {
    corrections.push({
      vendor: vendor.trim(),
      originalCategory,
      correctedCategory,
      count: 1,
      lastUpdated: new Date().toISOString(),
    })
  }

  // Keep only the most recent 200 corrections to avoid unbounded growth
  const trimmed = corrections
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, 200)

  saveCorrections(trimmed)
}

/**
 * Get the suggested category for a vendor based on past corrections.
 * Returns the most-corrected-to category if at least one correction exists,
 * otherwise null.
 */
export function getSuggestedCategory(vendor: string): TransactionCategory | null {
  if (!vendor.trim()) return null

  const corrections = loadCorrections()
  const key = normalizeVendor(vendor)

  const matches = corrections.filter((c) => normalizeVendor(c.vendor) === key)
  if (matches.length === 0) return null

  // Return the correction with the highest count
  const best = matches.reduce((a, b) => (b.count > a.count ? b : a))
  return best.correctedCategory
}
