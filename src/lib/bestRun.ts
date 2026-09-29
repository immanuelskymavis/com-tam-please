import type { RunStats } from '../game/scoring.ts'
import { shareOfMax, starsFor } from '../game/scoring.ts'

/**
 * The best week you've had, kept in this browser.
 *
 * Deliberately small and deliberately forgiving: `localStorage` throws in a
 * private window and comes back empty after a clear, so every read and write is
 * guarded and the game has to work identically when it returns nothing.
 */
const KEY = 'com-tam-please:best:v1'

export type BestRun = {
  score: number
  stars: number
  /** Kept alongside the score because two dealt weeks aren't worth the same. */
  share: number
  daysCleared: number
  bestStreak: number
  accuracy: number
  /** ISO date, for the "set on" line. */
  at: string
}

const accuracyOf = (stats: RunStats) =>
  stats.correct + stats.wrong > 0
    ? Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)
    : 0

export function toBest(stats: RunStats): BestRun {
  return {
    score: stats.score,
    stars: starsFor(stats),
    share: shareOfMax(stats),
    daysCleared: stats.daysCleared,
    bestStreak: stats.bestStreak,
    accuracy: accuracyOf(stats),
    at: new Date().toISOString().slice(0, 10),
  }
}

export function readBest(): BestRun | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BestRun>
    // Anything could be in there — an older shape, or something else entirely.
    return typeof parsed?.score === 'number' && Number.isFinite(parsed.score)
      ? {
          score: parsed.score,
          stars: Number(parsed.stars) || 0,
          share: Number(parsed.share) || 0,
          daysCleared: Number(parsed.daysCleared) || 0,
          bestStreak: Number(parsed.bestStreak) || 0,
          accuracy: Number(parsed.accuracy) || 0,
          at: typeof parsed.at === 'string' ? parsed.at : '',
        }
      : null
  } catch {
    return null
  }
}

export type RunRecord = { previous: BestRun | null; isBest: boolean }

/** One run, one recording — see `recordRun`. */
let lastRecorded: { key: string; result: RunRecord } | null = null

const signature = (s: RunStats) =>
  [s.score, s.maxScore, s.daysCleared, s.correct, s.wrong, s.walkouts, s.bestStreak].join('|')

/**
 * Records the run if it beat the stored one. Returns the previous best and
 * whether this run replaced it, so the end card can say "new best" and still
 * show what was beaten.
 *
 * Recording the same run twice is the same event, so the answer is memoised.
 * Without that, React's StrictMode double-invokes the caller's state
 * initialiser: the first call writes the new best, the second reads it back,
 * finds it isn't beaten, and the "new best" badge never appears.
 */
export function recordRun(stats: RunStats): RunRecord {
  const key = signature(stats)
  if (lastRecorded?.key === key) return lastRecorded.result

  const previous = readBest()
  const isBest = stats.score > 0 && (previous === null || stats.score > previous.score)
  if (isBest) {
    try {
      localStorage.setItem(KEY, JSON.stringify(toBest(stats)))
    } catch {
      // A browser that won't store it still gets the badge for this session.
    }
  }
  const result = { previous, isBest }
  lastRecorded = { key, result }
  return result
}

export function clearBest() {
  lastRecorded = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
