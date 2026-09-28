import type { DayDef, Encounter, RuleId } from './types.ts'
import { rulesForDay } from './types.ts'
import { bankMatchesBin, CO_BA_STALL } from '../lib/vietqr.ts'

/**
 * The single source of truth for whether a receipt is good.
 *
 * Deliberately independent of `encounter.violation` — that field is the content
 * author's intent, and this function is the mechanical check. Running both and
 * comparing is what `audit.ts` does, which catches days authored wrong.
 */
export function findViolation(
  encounter: Encounter,
  day: DayDef,
  usedTxIds: readonly string[],
): RuleId | null {
  const { receipt, ticket } = encounter
  const active = new Set(rulesForDay(day.day).map((r) => r.id))

  // Order matters: report the tell the player is most likely to spot first.
  if (active.has('screenshot') && receipt.expiresIn === null) return 'screenshot'
  if (active.has('expiry') && receipt.status === 'expired') return 'expiry'
  if (active.has('recipient') && receipt.account !== CO_BA_STALL.account) return 'recipient'
  if (active.has('duplicate') && usedTxIds.includes(receipt.txId)) return 'duplicate'

  if (active.has('currency') && receipt.currency !== 'VND') return 'currency'

  if (active.has('bankMismatch') && !bankMatchesBin(receipt.bankName, receipt.bankBin)) {
    return 'bankMismatch'
  }

  if (active.has('rate') && receipt.usd != null && receipt.rate != null) {
    // The printed rate must match the board, and the arithmetic must actually work.
    if (receipt.rate !== day.postedRate) return 'rate'
    const implied = Math.round(receipt.usd * receipt.rate)
    if (Math.abs(implied - receipt.amount) > receipt.amount * 0.02) return 'rate'
  }

  // A static-QR underpayment is still an amount mismatch, but it reads as its own
  // rule to the player, so attribute it to whichever rule is unlocked.
  if (receipt.amount !== ticket.total) {
    if (receipt.fromStaticQr && active.has('staticQr')) return 'staticQr'
    if (active.has('amount')) return 'amount'
  }

  return null
}

export type CallOutcome = {
  /** Did the player make the right call? */
  correct: boolean
  /** What was actually wrong with the receipt, if anything. */
  violation: RuleId | null
  moneyDelta: number
  reputationDelta: number
  /** Which Spine animation the customer should play in response. */
  reaction: 'served' | 'refusedFairly' | 'refusedUnfairly' | 'scammedYou' | 'walkedOut'
}

/** They ran out of patience and left. No sale, but no strike either — you didn't wrong them. */
export function walkout(encounter: Encounter): CallOutcome {
  return {
    correct: false,
    violation: null,
    moneyDelta: 0,
    reputationDelta: 0,
    reaction: 'walkedOut',
  }
}

export function resolveCall(
  encounter: Encounter,
  day: DayDef,
  usedTxIds: readonly string[],
  served: boolean,
  plateValue: number,
): CallOutcome {
  const violation = findViolation(encounter, day, usedTxIds)
  const isGood = violation === null

  if (served && isGood) {
    return { correct: true, violation, moneyDelta: plateValue, reputationDelta: 0, reaction: 'served' }
  }
  if (served && !isGood) {
    // You handed over food for a payment that never landed. You ate the cost.
    return { correct: false, violation, moneyDelta: -plateValue, reputationDelta: 0, reaction: 'scammedYou' }
  }
  if (!served && !isGood) {
    return { correct: true, violation, moneyDelta: 0, reputationDelta: 0, reaction: 'refusedFairly' }
  }
  // Refused someone who actually paid.
  return { correct: false, violation, moneyDelta: 0, reputationDelta: 1, reaction: 'refusedUnfairly' }
}
