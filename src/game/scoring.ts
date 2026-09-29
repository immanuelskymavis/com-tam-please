import type { CallOutcome } from './validate.ts'
import type { DayDef } from './types.ts'

/**
 * What a call is worth, as a small P&L.
 *
 * You've taken over grandma's stall and you're trying to have a profitable week.
 * Two things pay you, and they're deliberately separate numbers:
 *
 *   money  — đồng across the counter. Gross revenue. Rent comes out of it, and
 *            what's left is the day's profit.
 *   bonus  — what PayMoji pays you on top, because you're clearing their
 *            payments quickly and calling them correctly. Speed, streaks and
 *            catching fraud all land here, and a wrong refusal is docked from it.
 *
 *   salary today  = (gross − rent) + bonus
 *   weekly subtotal = the salaries banked so far
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
 * Without it, blind refusal is close to free: it survives the early days on two
 * strikes apiece and banks every catch. The strike allowance exists to forgive
 * slips, not to make indiscriminate refusal viable, so the score does the work
 * the strike counter deliberately doesn't. See src/game/sim.ts.
 */
export const WRONG_REFUSAL_PENALTY = 0.5

/** 1.0x on the first correct call, climbing while the streak holds. */
export const streakMultiplier = (streakBefore: number) =>
  Math.min(1 + Math.max(0, streakBefore) * STREAK_STEP, STREAK_CAP)

/** `patienceLeft` is 0–1; calling while they're still calm pays best. */
export const speedFactor = (patienceLeft: number) =>
  1 + SPEED_MAX_BONUS * Math.min(1, Math.max(0, patienceLeft))

export type Award = {
  /** Đồng across the counter. Gross revenue; rent comes out of the day's total. */
  money: number
  /** What PayMoji pays on top for speed, streaks and accurate calls. */
  bonus: number
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
      // The ticket is revenue; everything the multipliers add on top is PayMoji's.
      return {
        money: ticketTotal,
        bonus: Math.round(ticketTotal * (scale - 1)),
        streak: streakBefore + 1,
        strike: false,
        multiplier,
        speed,
      }

    case 'refusedFairly':
      // No sale at all, so no revenue — the whole reward is PayMoji paying you
      // for catching something their receipt was trying to tell you.
      return {
        money: 0,
        bonus: Math.round(ticketTotal * CATCH_SHARE * scale),
        streak: streakBefore + 1,
        strike: false,
        multiplier,
        speed,
      }

    case 'scammedYou':
      // Food went out, money never arrived: straight off the top line.
      return { money: -ticketTotal, bonus: 0, streak: 0, strike: true, multiplier, speed }

    case 'refusedUnfairly':
      // No revenue lost, but PayMoji docks you for turning away a good payment.
      return {
        money: 0,
        bonus: -Math.round(ticketTotal * WRONG_REFUSAL_PENALTY),
        streak: 0,
        strike: true,
        multiplier,
        speed,
      }

    case 'walkedOut':
      // They gave up waiting. Costs you the sale and the streak, but you didn't
      // wrong anyone, so it isn't a strike.
      return { money: 0, bonus: 0, streak: 0, strike: false, multiplier, speed }
  }
}

export type RunStats = {
  score: number
  /** What a flawless, instant run of this exact week would have scored. */
  maxScore: number
  /** Stars earned per day, in order, for the days that were actually banked. */
  dayStars: number[]
  /** The day the run ended on — not derivable from daysCleared once a day is replayed. */
  dayReached: number
  correct: number
  wrong: number
  walkouts: number
  bestStreak: number
  daysCleared: number
}

/**
 * The ceiling for a given week: every call right, every call instant.
 *
 * It has to be computed rather than constant, because the week is dealt fresh
 * each run and two weeks are not worth the same. Everything the player sees
 * afterwards — rank, stars, the percentage — is measured against this, so a
 * lucky deal of expensive tickets can't inflate a result.
 */
export function perfectScore(days: readonly DayDef[]): number {
  let streak = 0
  let total = 0
  for (const day of days) {
    total += perfectDayScore(day, streak)
    streak += day.encounters.length
  }
  return total
}

/**
 * The best salary one day could pay: every call right, every call instant, rent
 * still due.
 *
 * Taking the incoming streak as given is what makes a day's stars about *this
 * day*: a long streak lifts the day's salary and its ceiling by the same factor,
 * so it cancels, and Monday can be three-starred as easily as Friday.
 */
export function perfectDayScore(day: DayDef, streakBefore = 0): number {
  let streak = Math.max(0, streakBefore)
  // Rent is due whatever kind of day you have, so the ceiling pays it too.
  let total = -day.rent
  for (const e of day.encounters) {
    const base = e.violation === null ? e.ticket.total : e.ticket.total * CATCH_SHARE
    total += Math.round(base * streakMultiplier(streak) * speedFactor(1))
    streak++
  }
  return total
}

export const shareOfMax = (stats: RunStats) =>
  stats.maxScore > 0 ? Math.max(0, stats.score) / stats.maxScore : 0

/**
 * Stars are the headline and the rank is the flavour, so they read off one number:
 * how close you came to the ceiling. Three stars needs accuracy *and* speed — a
 * flawless but dawdling run tops out around 74% of the ceiling, which is two.
 */
export const STAR_THRESHOLDS = [0.7, 0.45, 0.2] as const

export const starsForShare = (share: number): 0 | 1 | 2 | 3 => {
  if (share >= STAR_THRESHOLDS[0]) return 3
  if (share >= STAR_THRESHOLDS[1]) return 2
  if (share >= STAR_THRESHOLDS[2]) return 1
  return 0
}

export const starsFor = (stats: RunStats): 0 | 1 | 2 | 3 => starsForShare(shareOfMax(stats))

/** Same thresholds for a day as for a week, so three stars means one thing. */
export const starsForDay = (dayScore: number, dayCeiling: number) =>
  starsForShare(dayCeiling > 0 ? Math.max(0, dayScore) / dayCeiling : 0)

/** ★★☆ — used on the end card and in the shared block. */
export const starBlock = (stars: number) => '★'.repeat(stars) + '☆'.repeat(3 - stars)

/** Thresholds are shares of a perfect week, so they survive a re-dealt week. */
const RANKS: { at: number; title: string; blurb: string }[] = [
  { at: 0.85, title: 'Cô Ba herself', blurb: 'Grandma has nothing left to teach you' },
  { at: 0.7, title: 'Runs the block', blurb: 'The phở place has started copying you' },
  { at: 0.55, title: 'Knows the codes', blurb: 'You read a BIN faster than the board' },
  { at: 0.35, title: 'Holding the stall', blurb: 'Rent paid, most days' },
  { at: 0.15, title: 'Still learning', blurb: 'A few plates went out for free' },
  { at: -Infinity, title: 'Rough week', blurb: 'Grandma is not angry, just disappointed' },
]

export const rankFor = (stats: RunStats) =>
  RANKS.find((r) => shareOfMax(stats) >= r.at) ?? RANKS[RANKS.length - 1]

/** Wordle-style block — short enough to paste anywhere. */
export function shareText(stats: RunStats, totalDays: number, url: string): string {
  const rank = rankFor(stats)
  const stars = starsFor(stats)
  const dong = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₫`
  return [
    `Cơm Tấm, Please — ${stats.daysCleared}/${totalDays} days`,
    '⭐'.repeat(stars) + '·'.repeat(3 - stars),
    `${dong(stats.score)} earned  (${Math.round(shareOfMax(stats) * 100)}% of perfect)`,
    '',
    stats.dayStars.map(starBlock).join(' ') || '—',
    `✅ ${stats.correct}   ❌ ${stats.wrong}   🚶 ${stats.walkouts}`,
    `🔥 Best streak ${stats.bestStreak}`,
    `💚 Stall profit + bonus from PayMoji`,
    `🍚 ${rank.title}`,
    '',
    url,
  ].join('\n')
}
