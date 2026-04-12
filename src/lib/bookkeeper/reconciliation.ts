import type { Transaction } from '@/lib/supabase/types'

/** A matched pair of bank statement entry and manual transaction */
export interface ReconciliationMatch {
  bankTransaction: Transaction
  manualTransaction: Transaction
  dateDiffDays: number
  amountDiffPercent: number
}

/** Result of running reconciliation */
export interface ReconciliationResult {
  matched: ReconciliationMatch[]
  unmatchedBank: Transaction[]
  unmatchedManual: Transaction[]
}

/**
 * Match bank statement entries against manually entered transactions.
 *
 * Matching criteria:
 *  - Date: within 1 calendar day
 *  - Amount: within 5 % tolerance
 *  - Same transaction type (INCOME / EXPENSE)
 *
 * Uses greedy best-match: closest amount difference wins when multiple
 * candidates exist.
 */
export function reconcileTransactions(
  bankTransactions: Transaction[],
  manualTransactions: Transaction[]
): ReconciliationResult {
  const matched: ReconciliationMatch[] = []
  const usedBankIds = new Set<string>()
  const usedManualIds = new Set<string>()

  // Sort bank transactions by date for deterministic matching
  const sortedBank = [...bankTransactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const bankTx of sortedBank) {
    const bankDate = new Date(bankTx.date).getTime()
    const oneDayMs = 86_400_000

    let bestMatch: {
      manual: Transaction
      dateDiff: number
      amountDiff: number
    } | null = null

    for (const manualTx of manualTransactions) {
      if (usedManualIds.has(manualTx.id)) continue
      if (bankTx.type !== manualTx.type) continue

      const manualDate = new Date(manualTx.date).getTime()
      const dateDiffMs = Math.abs(bankDate - manualDate)
      const dateDiffDays = dateDiffMs / oneDayMs

      if (dateDiffDays > 1) continue

      const amountDiff =
        bankTx.amount === 0
          ? manualTx.amount === 0
            ? 0
            : 100
          : Math.abs((bankTx.amount - manualTx.amount) / bankTx.amount) * 100

      if (amountDiff > 5) continue

      if (
        !bestMatch ||
        amountDiff < bestMatch.amountDiff ||
        (amountDiff === bestMatch.amountDiff && dateDiffDays < bestMatch.dateDiff)
      ) {
        bestMatch = { manual: manualTx, dateDiff: dateDiffDays, amountDiff }
      }
    }

    if (bestMatch) {
      matched.push({
        bankTransaction: bankTx,
        manualTransaction: bestMatch.manual,
        dateDiffDays: bestMatch.dateDiff,
        amountDiffPercent: bestMatch.amountDiff,
      })
      usedBankIds.add(bankTx.id)
      usedManualIds.add(bestMatch.manual.id)
    }
  }

  const unmatchedBank = bankTransactions.filter((tx) => !usedBankIds.has(tx.id))
  const unmatchedManual = manualTransactions.filter((tx) => !usedManualIds.has(tx.id))

  return { matched, unmatchedBank, unmatchedManual }
}
