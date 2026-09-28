/**
 * Content audit: does each encounter's authored `violation` match what the
 * validator mechanically computes? A mismatch means the day is authored wrong
 * and the player would be marked incorrect for a correct call.
 *
 * Run with: npx esbuild src/game/audit.ts --bundle --format=esm | node --input-type=module
 */
import { DAYS } from '../content/days.ts'
import { findViolation } from './validate.ts'
import { rulesForDay } from './types.ts'

export function audit() {
  const problems: string[] = []
  let checked = 0

  for (const day of DAYS) {
    const seen: string[] = []
    const active = rulesForDay(day.day).map((r) => r.id)

    for (const e of day.encounters) {
      checked++
      const computed = findViolation(e, day, seen)
      if (computed !== e.violation) {
        problems.push(
          `${e.id}: authored=${e.violation ?? 'none'} computed=${computed ?? 'none'}`,
        )
      }
      // An authored violation must be a rule the player has actually been taught.
      if (e.violation && !active.includes(e.violation)) {
        problems.push(`${e.id}: violation '${e.violation}' is not unlocked by day ${day.day}`)
      }
      seen.push(e.receipt.txId)
    }

    const good = day.encounters.filter((e) => e.violation === null)
    const earnable = good.reduce((sum, e) => sum + e.ticket.total, 0)
    // A day needs real headroom: rent should sit around 70-80% of a perfect run so
    // one wrong call stings without being instantly fatal.
    const share = day.rent / earnable
    if (share > 0.85) {
      problems.push(
        `day ${day.day}: rent is ${(share * 100).toFixed(0)}% of a perfect run — too tight`,
      )
    }
    console.log(
      `day ${day.day}: ${day.encounters.length} customers, ${good.length} good, ` +
        `perfect run ₫${earnable.toLocaleString()} vs rent ₫${day.rent.toLocaleString()}` +
        `  (margin ₫${(earnable - day.rent).toLocaleString()})`,
    )
  }

  console.log(`\nchecked ${checked} encounters`)
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`)
    for (const p of problems) console.log('  ✗', p)
  } else {
    console.log('no problems — every authored violation matches the validator')
  }
  return problems
}

audit()
