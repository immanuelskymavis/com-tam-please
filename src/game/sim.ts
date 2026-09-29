/**
 * Headless playthroughs across many dealt weeks. Confirms the balance holds
 * whatever the deal: a perfect player finishes and earns three stars, a merely
 * sloppy one survives (the point of moving the fail condition off rent), and
 * neither brute-force strategy gets anywhere near a real score.
 *
 * Run with:
 *   npx esbuild src/game/sim.ts --bundle --format=esm | node --input-type=module
 */
import type { Action, State } from './store.ts'
import { initialState, madeRent, reducer, runStats } from './store.ts'
import { findDay, rollRun, TOTAL_DAYS } from '../content/days.ts'
import { findViolation } from './validate.ts'
import { STRIKE_LIMIT, perfectDayScore, rankFor, shareOfMax, starsFor } from './scoring.ts'
import { dong } from '../lib/format.ts'

type Strategy = 'perfect' | 'serveAll' | 'refuseAll' | 'oneSlipADay' | 'slips'

const run = (s: State, a: Action) => reducer(s, a)

/** Mid-range patience: what someone who actually reads the receipt manages. */
const PATIENCE = 0.5
const SEEDS = Number(process.env.SEEDS ?? 40)

function play(mode: Strategy, patience = PATIENCE, slipBudget = 0) {
  let s = run(initialState, { type: 'start' })
  const log: string[] = []
  let guard = 0
  let slipsToday = 0
  let slipsLeft = slipBudget
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
      } else if (mode === 'slips' && slipsLeft > 0 && slipsToday < 1) {
        // At most one a day, so the budget models a player who slips now and
        // then rather than one who deliberately strikes out on day one.
        served = !genuine
        slipsLeft--
        slipsToday++
      } else served = genuine

      s = run(s, { type: 'call', served, patienceLeft: patience })
      continue
    }
    if (s.phase === 'feedback') {
      s = run(s, { type: 'next' })
      continue
    }
    if (s.phase === 'dayEnd') {
      const day = findDay(s.day)!
      log.push(
        `  day ${s.day}: ${s.strikes}/${STRIKE_LIMIT} strikes · ` +
          `gross ${dong(s.earned)} − rent ${dong(day.rent)}` +
          `${madeRent(s) ? '' : ' (in the red)'} + paymoji ${dong(s.bonus)} · ` +
          `week ${dong(s.score)}${s.failedOut ? '  ← STRUCK OUT' : ''}`,
      )
      if (s.failedOut) break
      s = run(s, { type: 'advanceDay' })
      continue
    }
    break
  }
  return { s, log, stats: runStats(s), finished: s.phase === 'finished' }
}

let failed = false
const fail = (msg: string) => {
  console.log('  ✗ ' + msg)
  failed = true
}

// ---------------------------------------------------------------------------
// One week in full, so the shape of a run is readable.
// ---------------------------------------------------------------------------
rollRun(1)
console.log('SEED 1, played four ways:\n')
for (const [mode, title] of [
  ['perfect', 'PERFECT — never wrong'],
  ['oneSlipADay', 'SLOPPY — exactly one mistake every day'],
  ['serveAll', 'CREDULOUS — serves everyone'],
  ['refuseAll', 'PARANOID — refuses everyone'],
] as [Strategy, string][]) {
  const { s, log, stats, finished } = play(mode)
  console.log(title + ':')
  log.forEach((l) => console.log(l))
  console.log(
    `  → ${finished ? 'finished the week' : `struck out on day ${s.day}`} · ` +
      `${dong(stats.score)} of ${dong(stats.maxScore)} (${Math.round(shareOfMax(stats) * 100)}%) · ` +
      `${'★'.repeat(starsFor(stats))}${'☆'.repeat(3 - starsFor(stats))} · ` +
      `best streak ${stats.bestStreak} · ${rankFor(stats).title}\n`,
  )
}

// ---------------------------------------------------------------------------
// Then the same four strategies over many deals, because the week is dealt.
// ---------------------------------------------------------------------------
console.log(`across ${SEEDS} dealt weeks:`)
const shares: Partial<Record<Strategy, number[]>> = { perfect: [], oneSlipADay: [], serveAll: [], refuseAll: [] }
const starsSeen: Record<string, number[]> = { fast: [], mid: [], slow: [] }
let perfectFinishes = 0
let sloppyFinishes = 0

for (let seed = 1; seed <= SEEDS; seed++) {
  rollRun(seed)
  for (const mode of ['perfect', 'oneSlipADay', 'serveAll', 'refuseAll'] as Strategy[]) {
    const { stats, finished } = play(mode)
    shares[mode]!.push(shareOfMax(stats))
    if (mode === 'perfect' && finished) perfectFinishes++
    if (mode === 'oneSlipADay' && finished) sloppyFinishes++
  }
  // Star thresholds are the promise the end screen makes, so check what three
  // styles of flawless play actually earn.
  starsSeen.fast.push(starsFor(play('perfect', 0.85).stats))
  starsSeen.mid.push(starsFor(play('perfect', 0.55).stats))
  starsSeen.slow.push(starsFor(play('perfect', 0.15).stats))
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (x: number) => `${Math.round(x * 100)}%`

for (const mode of ['perfect', 'oneSlipADay', 'serveAll', 'refuseAll'] as Strategy[]) {
  const xs = shares[mode]!
  console.log(
    `  ${mode.padEnd(12)} ${pct(avg(xs)).padStart(4)} of ceiling ` +
      `(${pct(Math.min(...xs))}–${pct(Math.max(...xs))})`,
  )
}
console.log(
  `  stars for flawless play: quick ${avg(starsSeen.fast).toFixed(1)}★ · ` +
    `steady ${avg(starsSeen.mid).toFixed(1)}★ · dithering ${avg(starsSeen.slow).toFixed(1)}★`,
)

if (perfectFinishes !== SEEDS) fail(`a perfect run should always finish (${perfectFinishes}/${SEEDS})`)
if (sloppyFinishes !== SEEDS) fail(`one mistake a day should always survive (${sloppyFinishes}/${SEEDS})`)
// Brute force has to land nowhere near a real run.
for (const mode of ['serveAll', 'refuseAll'] as const) {
  const worst = Math.max(...shares[mode]!)
  if (worst >= 0.25) fail(`${mode} reaches ${pct(worst)} of the ceiling — too rewarding`)
}
// Three stars must be reachable but never automatic.
// And the curve between flawless and sloppy has to be a curve, not a cliff.
{
  const curve = [0, 1, 2, 3, 4, 5].map((budget) => {
    const stars: number[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      rollRun(seed)
      stars.push(starsFor(play('slips', PATIENCE, budget).stats))
    }
    return avg(stars)
  })
  console.log(
    '  stars by mistakes in the week — ' +
      curve.map((v, i) => `${i} slip${i === 1 ? '' : 's'}: ${v.toFixed(1)}★`).join(' · '),
  )
  if (curve.some((v, i) => i > 0 && v > curve[i - 1] + 0.01)) {
    fail('more mistakes should never mean more stars')
  }
  if (curve[5] > 2) fail('a mistake every single day should not still be three stars')
  if (curve[5] < 1) fail('a mistake every single day should still be worth a star')
}

if (Math.min(...starsSeen.fast) < 3) fail('quick flawless play should always be three stars')
if (Math.max(...starsSeen.slow) > 2) fail('dithering through a flawless week should not be three stars')

// ---------------------------------------------------------------------------
// Per-day stars: a day is rated against a flawless run of *that* day.
// ---------------------------------------------------------------------------
{
  const perDay: { flawless: number[][]; sloppy: number[][] } = { flawless: [], sloppy: [] }
  for (let seed = 1; seed <= SEEDS; seed++) {
    rollRun(seed)
    perDay.flawless.push(play('perfect', 0.85).s.dayStars)
    perDay.sloppy.push(play('oneSlipADay').s.dayStars)
  }
  const flat = (xs: number[][]) => xs.flat()
  const worstFlawless = Math.min(...flat(perDay.flawless))
  const bestSloppy = Math.max(...flat(perDay.sloppy))
  console.log(
    `  day stars: flawless days score ${worstFlawless}-${Math.max(...flat(perDay.flawless))}★, ` +
      `days with a mistake ${Math.min(...flat(perDay.sloppy))}-${bestSloppy}★`,
  )
  if (worstFlawless < 3) fail('a day played flawlessly and quickly should be three stars')
  if (bestSloppy > 2) fail('a day with a mistake in it should not be three stars')
  if (perDay.flawless.some((week) => week.length !== TOTAL_DAYS)) {
    fail('a finished week should bank a rating for every day')
  }

  // The incoming streak must cancel out, or Friday would be easier to
  // three-star than Monday for reasons that have nothing to do with Friday.
  rollRun(1)
  const day3 = findDay(3)!
  const cold = perfectDayScore(day3, 0)
  const hot = perfectDayScore(day3, 30)
  const ok = hot > cold
  console.log(`  a day's ceiling rises with the streak you bring: ${cold} → ${hot} ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

// ---------------------------------------------------------------------------
// Mechanics that are easy to break and hard to notice.
// ---------------------------------------------------------------------------
rollRun(1)
console.log()

// Replaying a day must not count it twice.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const day = findDay(s.day)!
  const genuine = findViolation(day.encounters[0], day, s.usedTxIds) === null
  s = run(s, { type: 'call', served: genuine, patienceLeft: 1 })
  const afterOne = s.score
  s = run(s, { type: 'next' })
  s = run(s, { type: 'retryDay' })
  const ok = afterOne > 0 && s.score === 0 && s.strikes === 0
  console.log(`retry rewinds the day's score: ${afterOne} → ${s.score} ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

// A retried day must be the same day, not a fresh deal.
{
  const before = findDay(3)!.encounters.map((e) => e.id + e.receipt.txId).join()
  const again = findDay(3)!.encounters.map((e) => e.id + e.receipt.txId).join()
  const ok = before === again
  console.log(`a replayed day deals the same customers ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
}

// A fresh run must not.
{
  const a = findDay(3)!.encounters.map((e) => e.receipt.txId).join()
  rollRun(999)
  const b = findDay(3)!.encounters.map((e) => e.receipt.txId).join()
  const ok = a !== b
  console.log(`a new run deals a different week ${ok ? '✓' : '✗'}`)
  if (!ok) failed = true
  rollRun(1)
}

// Streaks have to actually pay.
{
  let s = run(initialState, { type: 'start' })
  s = run(s, { type: 'beginDay' })
  const first = findDay(s.day)!.encounters[0]
  const solo = reducer(s, { type: 'call', served: true, patienceLeft: 1 }).score
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
console.log(failed ? 'FAILED' : `balance holds across ${SEEDS} dealt weeks of ${TOTAL_DAYS} days`)
