/**
 * Content audit. Days 2-5 are dealt at runtime, so this runs the check over many
 * seeds rather than over one authored file: does each encounter's `violation`
 * match what the validator mechanically computes, does every rule a morning
 * promises actually turn up, and does rent stay winnable?
 *
 * Run with: npx esbuild src/game/audit.ts --bundle --format=esm | node --input-type=module
 */
import { buildDays, PLAN, TOTAL_DAYS } from '../content/days.ts'
import { findViolation } from './validate.ts'
import { rulesForDay } from './types.ts'
import { perfectScore } from './scoring.ts'

const SEEDS = Number(process.env.SEEDS ?? 200)

export function audit() {
  const problems: string[] = []
  let checked = 0
  const maxes: number[] = []

  for (let seed = 1; seed <= SEEDS; seed++) {
    const days = buildDays(seed)
    maxes.push(perfectScore(days))

    for (const day of days) {
      const seen: string[] = []
      const active = rulesForDay(day.day).map((r) => r.id)
      const plan = PLAN.find((p) => p.day === day.day)!
      const where = `seed ${seed} day ${day.day}`

      for (const e of day.encounters) {
        checked++
        const computed = findViolation(e, day, seen)
        if (computed !== e.violation) {
          problems.push(`${where} ${e.id}: authored=${e.violation ?? 'none'} computed=${computed ?? 'none'}`)
        }
        // An authored violation must be a rule the player has actually been taught.
        if (e.violation && !active.includes(e.violation)) {
          problems.push(`${where} ${e.id}: '${e.violation}' is not unlocked yet`)
        }
        seen.push(e.receipt.txId)
      }

      // Every rule this morning promises has to show up, or the lesson never lands.
      const shown = new Set(day.encounters.map((e) => e.violation))
      for (const rule of plan.teaches) {
        const expected = day.stickerDay && rule === 'amount' ? 'staticQr' : rule
        if (!shown.has(expected)) problems.push(`${where}: taught '${rule}' but never showed it`)
      }

      const good = day.encounters.filter((e) => e.violation === null)
      if (good.length === 0) problems.push(`${where}: no honest customers at all`)
      const earnable = good.reduce((sum, e) => sum + e.ticket.total, 0)
      // Rent is a fixed cost on a day you're meant to run at a profit: it has to
      // stay small enough that the stall is almost always in the black, and big
      // enough to still be a line worth reading.
      const share = day.rent / earnable
      if (share > 0.35) problems.push(`${where}: rent is ${(share * 100).toFixed(0)}% of gross — too heavy to stay profitable`)
      if (share < 0.15) problems.push(`${where}: rent is ${(share * 100).toFixed(0)}% of gross — not worth printing`)
    }
  }

  // One representative week, printed so the shape of a run is readable.
  console.log(`sample week (seed 1):`)
  for (const day of buildDays(1)) {
    const good = day.encounters.filter((e) => e.violation === null)
    const tells = day.encounters.map((e) => e.violation ?? '·').join(' ')
    console.log(
      `  day ${day.day}: ${day.encounters.length} customers, ${good.length} honest · ` +
        `rent ₫${day.rent.toLocaleString()} · rate ${day.postedRate.toLocaleString()} ₫/$` +
        `${day.stickerDay ? ' · sticker day' : ''}\n         ${tells}`,
    )
  }

  // Stars and rank are measured against each run's own ceiling, so an uneven
  // deal can't make three stars lucky. What the spread does affect is the raw
  // đồng people paste at each other, so the typical week still has to be a
  // comparable week: check the middle 90%, not the tails.
  const sorted = maxes.slice().sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const [p05, p50, p95] = [at(0.05), at(0.5), at(0.95)]
  const band = ((p95 - p05) / p50) * 100
  console.log(
    `\nperfect-week ceiling across ${SEEDS} seeds: median ₫${p50.toLocaleString()}, ` +
      `5th–95th ₫${p05.toLocaleString()} – ₫${p95.toLocaleString()} (±${(band / 2).toFixed(0)}%), ` +
      `full range ₫${sorted[0].toLocaleString()} – ₫${sorted[sorted.length - 1].toLocaleString()}`,
  )
  if (band > 30) problems.push(`weeks vary too much: 90% of deals span ${band.toFixed(0)}% of the median`)

  console.log(`checked ${checked} encounters across ${SEEDS} seeds × ${TOTAL_DAYS} days`)
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`)
    for (const p of problems.slice(0, 25)) console.log('  ✗', p)
    if (problems.length > 25) console.log(`  … and ${problems.length - 25} more`)
  } else {
    console.log('no problems — every dealt violation matches the validator')
  }
  return problems
}

audit()
