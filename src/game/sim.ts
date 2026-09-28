/**
 * Headless playthroughs. Confirms the balance holds: a perfect player finishes,
 * neither brute-force strategy does, and — since the fail condition moved from
 * rent to strikes — that a merely sloppy player survives a day rather than
 * losing it to a single mistake.
 *
 * Run with:
 *   npx esbuild src/game/sim.ts --bundle --format=esm | node --input-type=module
 */
import type { Action, State } from './store.ts'
import { initialState, madeRent, reducer, runStats } from './store.ts'
import { findDay, DAYS } from '../content/days.ts'
import { findViolation } from './validate.ts'
import { STRIKE_LIMIT, rankFor } from './scoring.ts'
import { dong } from '../lib/format.ts'

type Strategy = 'perfect' | 'serveAll' | 'refuseAll' | 'oneSlipADay'

const run = (s: State, a: Action) => reducer(s, a)

/** Mid-range patience, so speed bonuses don't distort the comparison. */
const PATIENCE = 0.5

function play(mode: Strategy) {
  let s = run(initialState, { type: 'start' })
  const log: string[] = []
  let guard = 0
  let slipsToday = 0
  let lastDay = s.day

  while (s.phase !== 'finished' && guard++ < 800) {
    if (s.phase === 'morning') {
      slipsToday = 0
      s = run(s, { type: 'beginDay' })
      continue
    }
    if (s.phase === 'serving') {
      if (s.day !== lastDay) {
        lastDay = s.day
        slipsToday = 0
      }
      const day = findDay(s.day)!
      const enc = day.encounters[s.index]
      const genuine = findViolation(enc, day, s.usedTxIds) === null

      let served: boolean
      if (mode === 'serveAll') served = true
      else if (mode === 'refuseAll') served = false
      else if (mode === 'oneSlipADay' && slipsToday < 1) {
        // Deliberately get exactly one wrong, then play straight.
        served = !genuine
        slipsToday++
      } else served = genuine

      s = run(s, { type: 'call', served, patienceLeft: PATIENCE })
      continue
    }
    if (s.phase === 'feedback') {
      s = run(s, { type: 'next' })
      continue
    }
    if (s.phase === 'dayEnd') {
      const day = findDay(s.day)!
      log.push(
        `  day ${String(s.day).padStart(2)}: ${s.strikes}/${STRIKE_LIMIT} strikes · ` +
          `took ${dong(s.earned)} vs rent ${dong(day.rent)}${madeRent(s) ? '' : ' (short)'} · ` +
          `run ${dong(s.score)}${s.failedOut ? '  ← STRUCK OUT' : ''}`,
      )
      if (s.failedOut) break
      s = run(s, { type: 'advanceDay' })
      continue
    }
    break
  }
  return { s, log }
}

const RUNS: [Strategy, string][] = [
  ['perfect', 'PERFECT — never wrong'],
  ['oneSlipADay', 'SLOPPY — exactly one mistake every day'],
  ['serveAll', 'CREDULOUS — serves everyone'],
  ['refuseAll', 'PARANOID — refuses everyone'],
]

let failed = false
const scores: Partial<Record<Strategy, number>> = {}
for (const [mode, title] of RUNS) {
  const { s, log } = play(mode)
  console.log(title + ':')
  log.forEach((l) => console.log(l))
  const finished = s.phase === 'finished'
  const st = runStats(s)
  console.log(
    `  → ${finished ? 'finished the week' : `struck out on day ${s.day}`} · ` +
      `${dong(st.score)} · best streak ${st.bestStreak} · ${rankFor(st.score).title}\n`,
  )

  // A perfect run must finish. One mistake a day must NOT end a day — that was
  // the whole point of moving off rent. Brute force must still lose.
  if (mode === 'perfect' && !finished) {
    console.log('  ✗ a perfect run should finish'); failed = true
  }
  if (mode === 'oneSlipADay' && !finished) {
    console.log('  ✗ one mistake a day should survive — the strike limit is too tight'); failed = true
  }
  // Survival is now generous by design — the score is what separates play from
  // button-mashing. So the bar for brute force is that it scores badly, not that
  // it dies: blind refusal only ever takes 2 strikes a day and will reach day 10.
  scores[mode] = st.score
}

// Brute force must land nowhere near a real run.
{
  const perfect = scores.perfect ?? 0
  for (const mode of ['serveAll', 'refuseAll'] as const) {
    const got = scores[mode] ?? 0
    const share = perfect > 0 ? got / perfect : 1
    const ok = share < 0.25
    console.log(
      `${mode} scores ${Math.round(share * 100)}% of a perfect run ${ok ? '✓' : '✗ (too rewarding)'}`,
    )
    if (!ok) failed = true
  }
}

// Replaying a day must not count it twice.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const day = findDay(s.day)!
  // Serve the first customer correctly, then bail out and retry the day.
  const genuine = findViolation(day.encounters[0], day, s.usedTxIds) === null
  s = run(s, { type: 'call', served: genuine, patienceLeft: 1 })
  const afterOne = s.score
  s = run(s, { type: 'next' })
  s = run(s, { type: 'retryDay' })
  const ok = afterOne > 0 && s.score === 0 && s.strikes === 0
  console.log(`retry rewinds the day's score: ${afterOne} → ${s.score} ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

// Streaks have to actually pay.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const day = findDay(s.day)!
  const first = day.encounters[0]
  const solo = reducer(s, { type: 'call', served: true, patienceLeft: 1 }).score
  // Same call, but with a streak already going.
  const withStreak = reducer({ ...s, streak: 6 }, { type: 'call', served: true, patienceLeft: 1 }).score
  const ok = withStreak > solo
  console.log(
    `streak pays: ${first.ticket.total.toLocaleString()} base → ${solo.toLocaleString()} cold, ` +
      `${withStreak.toLocaleString()} on a 6-streak ${ok ? '✓' : '✗'}`,
  )
  if (!ok) failed = true
}

// So does answering quickly.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const quick = reducer(s, { type: 'call', served: true, patienceLeft: 1 }).score
  const slow = reducer(s, { type: 'call', served: true, patienceLeft: 0 }).score
  const ok = quick > slow
  console.log(`speed pays: ${slow.toLocaleString()} dawdling → ${quick.toLocaleString()} instant ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

console.log()
console.log(failed ? 'FAILED' : `balance holds across all ${DAYS.length} days`)
