import type { CallOutcome } from './validate.ts'

/**
 * What a call is worth.
 *
 * Money and score are deliberately different numbers. `earned` is real đồng across
 * the counter and settles against rent; `score` is what you're playing for over the
 * whole run, and it rewards two things the money alone doesn't: being right
 * repeatedly, and being quick about it.
 */

/** Each consecutive correct call adds this much multiplier… */
export const STREAK_STEP = 0.15
/** …up to this ceiling, so a long run is strong but not runaway. */
export const STREAK_CAP = 2.5
/** An instant call is worth this much more than one made as patience runs out. */
export const SPEED_MAX_BONUS = 0.6
/** Catching a fraud pays this share of the ticket you just avoided losing. */
export const CATCH_SHARE = 0.5
/** Mistakes allowed before the day is over. */
export const STRIKE_LIMIT = 3
/**
 * What turning away an honest customer costs, as a share of their ticket.
 * Without this, refusing everything is free: a day holds 4 customers of whom 2 are
 * frauds, so blind refusal takes exactly 2 strikes and never hits the limit. The
 * strike allowance is meant to forgive slips, not to make indiscriminate refusal
 * a viable strategy — so the score, not the strike counter, is what punishes it.
 */
export const WRONG_REFUSAL_PENALTY = 0.5

/** 1.0x on the first correct call, climbing while the streak holds. */
export const streakMultiplier = (streakBefore: number) =>
  Math.min(1 + Math.max(0, streakBefore) * STREAK_STEP, STREAK_CAP)

/** `patienceLeft` is 0–1; calling while they're still calm pays best. */
export const speedFactor = (patienceLeft: number) =>
  1 + SPEED_MAX_BONUS * Math.min(1, Math.max(0, patienceLeft))

export type Award = {
  /** Đồng actually taken at the counter — settles against rent. */
  money: number
  /** Points toward the run total. */
  points: number
  /** Streak after this call. */
  streak: number
  /** Did this count against the day's three strikes? */
  strike: boolean
  /** For the feedback slip. */
  multiplier: number
  speed: number
}

export function award(
  outcome: CallOutcome,
  ticketTotal: number,
  streakBefore: number,
  patienceLeft: number,
): Award {
  const multiplier = streakMultiplier(streakBefore)
  const speed = speedFactor(patienceLeft)
  const scale = multiplier * speed

  switch (outcome.reaction) {
    case 'served':
      return {
        money: ticketTotal,
        points: Math.round(ticketTotal * scale),
        streak: streakBefore + 1,
        strike: false,
        multiplier,
        speed,
      }

    case 'refusedFairly':
      // No sale, but you kept the plate and the money you'd have lost.
      return {
        money: 0,
        points: Math.round(ticketTotal * CATCH_SHARE * scale),
        streak: streakBefore + 1,
        strike: false,
        multiplier,
        speed,
      }

    case 'scammedYou':
      // Food went out, money never arrived.
      return { money: -ticketTotal, points: -ticketTotal, streak: 0, strike: true, multiplier, speed }

    case 'refusedUnfairly':
      return {
        money: 0,
        points: -Math.round(ticketTotal * WRONG_REFUSAL_PENALTY),
        streak: 0,
        strike: true,
        multiplier,
        speed,
      }

    case 'walkedOut':
      // They gave up waiting. Costs you the sale and the streak, but you didn't
      // wrong anyone, so it isn't a strike.
      return { money: 0, points: 0, streak: 0, strike: false, multiplier, speed }
  }
}

export type RunStats = {
  score: number
  /** The day the run ended on — not derivable from daysCleared once a day is replayed. */
  dayReached: number
  correct: number
  wrong: number
  walkouts: number
  bestStreak: number
  daysCleared: number
}

/**
 * Thresholds sit against a measured range: a flawless week scores about 7.0M at
 * middling speed, one mistake a day lands near 1.8M, and button-mashing tops out
 * around 0.3M. See src/game/sim.ts.
 */
const RANKS: { at: number; title: string; blurb: string }[] = [
  { at: 6_500_000, title: 'Cô Ba herself', blurb: 'Grandma has nothing left to teach you' },
  { at: 4_500_000, title: 'Runs the block', blurb: 'The phở place has started copying you' },
  { at: 3_000_000, title: 'Knows the codes', blurb: 'You read a BIN faster than the board' },
  { at: 1_800_000, title: 'Holding the stall', blurb: 'Rent paid, most days' },
  { at: 800_000, title: 'Still learning', blurb: 'A few plates went out for free' },
  { at: 0, title: 'Rough week', blurb: 'Grandma is not angry, just disappointed' },
]

export const rankFor = (score: number) => RANKS.find((r) => score >= r.at) ?? RANKS[RANKS.length - 1]

/** Wordle-style block — short enough to paste anywhere. */
export function shareText(stats: RunStats, totalDays: number, url: string): string {
  const rank = rankFor(stats.score)
  const dong = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₫`
  return [
    `Cơm Tấm, Please — ${stats.daysCleared}/${totalDays} days`,
    dong(stats.score),
    '',
    `✅ ${stats.correct}   ❌ ${stats.wrong}   🚶 ${stats.walkouts}`,
    `🔥 Best streak ${stats.bestStreak}`,
    `🍚 ${rank.title}`,
    '',
    url,
  ].join('\n')
}
