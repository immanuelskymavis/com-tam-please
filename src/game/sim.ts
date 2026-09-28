/**
 * Headless playthrough. Confirms the difficulty curve holds: a perfect player
 * finishes, and neither brute-force strategy does.
 *
 * Run with:
 *   npx esbuild src/game/sim.ts --bundle --format=esm | node --input-type=module
 */
import type { Action, State } from './store.ts'
import { initialState, madeRent, reducer } from './store.ts'
import { findDay } from '../content/days.ts'
import { findViolation } from './validate.ts'
import { dong } from '../lib/format.ts'

type Strategy = 'perfect' | 'serveAll' | 'refuseAll'

const run = (s: State, a: Action) => reducer(s, a)

function play(mode: Strategy) {
  let s = run(initialState, { type: 'start' })
  const log: string[] = []
  let guard = 0

  while (s.phase !== 'finished' && guard++ < 500) {
    if (s.phase === 'morning') {
      s = run(s, { type: 'beginDay' })
      continue
    }
    if (s.phase === 'serving') {
      const day = findDay(s.day)!
      const enc = day.encounters[s.index]
      const genuine = findViolation(enc, day, s.usedTxIds) === null
      s = run(s, { type: 'call', served: mode === 'perfect' ? genuine : mode === 'serveAll' })
      continue
    }
    if (s.phase === 'feedback') {
      s = run(s, { type: 'next' })
      continue
    }
    if (s.phase === 'dayEnd') {
      const day = findDay(s.day)!
      log.push(
        `  day ${s.day}: took ${dong(s.earned)} against rent ${dong(day.rent)} → ` +
          `${madeRent(s) ? 'CLEARED' : 'SHORT'}${s.reputation ? ` (rep ${s.reputation})` : ''}`,
      )
      if (!madeRent(s)) break
      s = run(s, { type: 'advanceDay' })
      continue
    }
    break
  }
  return { s, log }
}

const RUNS: [Strategy, string][] = [
  ['perfect', 'PERFECT — serves only genuine payments'],
  ['serveAll', 'CREDULOUS — serves everyone'],
  ['refuseAll', 'PARANOID — refuses everyone'],
]

let failed = false
for (const [mode, title] of RUNS) {
  const { s, log } = play(mode)
  console.log(title + ':')
  log.forEach((l) => console.log(l))
  const finished = s.phase === 'finished'
  console.log(`  → ${finished ? 'reached the end' : `stopped on day ${s.day}`}\n`)
  // A perfect player must finish; a brute-force one must not.
  if (mode === 'perfect' ? !finished : finished) {
    console.log(`  ✗ unexpected outcome for ${mode}`)
    failed = true
  }
}
// The shift clock closes the day wherever it happens to be.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  s = run(s, { type: 'call', served: true })
  s = run(s, { type: 'next' })
  const mid = s.phase
  s = run(s, { type: 'endDay' })
  const ok = mid === 'serving' && s.phase === 'dayEnd'
  console.log(`shift clock: mid-day ${mid} → ${s.phase} ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

// Patience running out costs the sale but must not cost reputation.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const before = s.reputation
  s = run(s, { type: 'walkout' })
  const o = s.lastOutcome
  const ok = o?.reaction === 'walkedOut' && o.moneyDelta === 0 && s.reputation === before
  console.log(`walkout: no money, no strike ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

console.log()
console.log(failed ? 'FAILED' : 'difficulty holds — only actually reading the receipt wins')
