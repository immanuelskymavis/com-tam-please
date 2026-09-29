import type { CallOutcome } from './validate.ts'
import { resolveCall, walkout } from './validate.ts'
import { allDays, findDay, TOTAL_DAYS as DAY_COUNT } from '../content/days.ts'
import { heroDish } from '../content/menu.ts'
import type { Encounter } from './types.ts'
import {
  award,
  perfectDayScore,
  perfectScore,
  starsForDay,
  STRIKE_LIMIT,
  type RunStats,
} from './scoring.ts'

export type Phase = 'title' | 'morning' | 'serving' | 'feedback' | 'dayEnd' | 'gameOver' | 'finished'

export type State = {
  phase: Phase
  day: number
  index: number
  /** Đồng taken today, reset each morning. Settles against rent at closing. */
  earned: number
  /** Wrong calls today. Hitting STRIKE_LIMIT ends the day — rent no longer can. */
  strikes: number
  /** Run total you're actually playing for, carried across days. */
  score: number
  /**
   * Run tallies as today opened, so replaying a day doesn't double-count it.
   * `streak` is in here because a day's own ceiling depends on the streak you
   * carried into it — see `perfectDayScore`.
   */
  dayStart: { score: number; correct: number; wrong: number; walkouts: number; streak: number }
  /** Stars for each day banked so far, in order. A retried day is scored once. */
  dayStars: number[]
  /** Consecutive correct calls. Drives the multiplier. */
  streak: number
  bestStreak: number
  correct: number
  wrong: number
  walkouts: number
  daysCleared: number
  /** Set when the day ended because the strikes ran out rather than the queue. */
  failedOut: boolean
  /** Transaction ids seen today. Resets each morning. */
  usedTxIds: string[]
  /**
   * Who actually walked away with food today, and what they got. Refused and
   * walked-out customers are absent — they have nothing to sit and eat.
   */
  fed: { axie: string; dish: string }[]
  lastOutcome:
    | (CallOutcome & { encounter: Encounter; award?: ReturnType<typeof award> })
    | null
}

/**
 * Demo jumps, read from the query string:
 *   ?day=3     open on day 3 (the sticker day — the rules worth showing)
 *   ?day=3&c=2 open on day 3 and go straight to its 2nd customer, skipping the cards
 *   ?seed=42   deal the same week every time
 * Nobody demoing wants to play four days to reach the interesting rule.
 */
function params(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
}

function startingDay(): number {
  const asked = Number(params().get('day'))
  if (!Number.isInteger(asked)) return 1
  return allDays().some((d) => d.day === asked) ? asked : 1
}

/** 1-based customer in the query string; 0-based index internally. null = start of day. */
function startingIndex(day: number): number | null {
  const raw = params().get('c')
  if (raw === null) return null
  const asked = Number(raw)
  const found = allDays().find((d) => d.day === day)
  if (!found || !Number.isInteger(asked)) return null
  return asked >= 1 && asked <= found.encounters.length ? asked - 1 : null
}

/** Skipping straight to a customer means skipping the title and morning cards. */
function openingPhase(): Phase {
  return startingIndex(startingDay()) === null ? 'title' : 'serving'
}

export const initialState: State = {
  phase: openingPhase(),
  day: startingDay(),
  index: startingIndex(startingDay()) ?? 0,
  earned: 0,
  strikes: 0,
  score: 0,
  dayStart: { score: 0, correct: 0, wrong: 0, walkouts: 0, streak: 0 },
  dayStars: [],
  streak: 0,
  bestStreak: 0,
  correct: 0,
  wrong: 0,
  walkouts: 0,
  daysCleared: 0,
  failedOut: false,
  usedTxIds: [],
  fed: [],
  lastOutcome: null,
}

export type Action =
  | { type: 'start' }
  | { type: 'beginDay' }
  /** `patienceLeft` is 0–1 at the moment of the call; it feeds the speed bonus. */
  | { type: 'call'; served: boolean; patienceLeft: number }
  | { type: 'walkout' }
  | { type: 'endDay' }
  | { type: 'next' }
  | { type: 'advanceDay' }
  | { type: 'retryDay' }
  | { type: 'restart' }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { ...initialState, day: startingDay(), phase: 'morning' }

    case 'beginDay':
      return {
        ...state,
        phase: 'serving',
        index: 0,
        earned: 0,
        strikes: 0,
        failedOut: false,
        dayStart: {
          score: state.score,
          correct: state.correct,
          wrong: state.wrong,
          walkouts: state.walkouts,
          streak: state.streak,
        },
        usedTxIds: [],
        fed: [],
        lastOutcome: null,
      }

    case 'call': {
      const day = findDay(state.day)
      if (!day) return state
      const encounter = day.encounters[state.index]
      if (!encounter) return state

      const outcome = resolveCall(
        encounter,
        day,
        state.usedTxIds,
        action.served,
        encounter.ticket.total,
      )

      const scored = award(outcome, encounter.ticket.total, state.streak, action.patienceLeft)
      const strikes = state.strikes + (scored.strike ? 1 : 0)

      // Handing the plate over feeds them whether or not the payment was real —
      // being scammed still costs you a plate of food.
      const gotFood = outcome.reaction === 'served' || outcome.reaction === 'scammedYou'

      return {
        ...state,
        // Running out of strikes closes the stall there and then.
        phase: strikes >= STRIKE_LIMIT ? 'dayEnd' : 'feedback',
        failedOut: strikes >= STRIKE_LIMIT,
        earned: state.earned + scored.money,
        score: state.score + scored.points,
        streak: scored.streak,
        bestStreak: Math.max(state.bestStreak, scored.streak),
        correct: state.correct + (outcome.correct ? 1 : 0),
        wrong: state.wrong + (scored.strike ? 1 : 0),
        strikes,
        usedTxIds: [...state.usedTxIds, encounter.receipt.txId],
        fed: gotFood
          ? [...state.fed, { axie: encounter.axie, dish: heroDish(encounter.ticket.lines).image }]
          : state.fed,
        lastOutcome: { ...outcome, encounter, award: scored },
      }
    }

    case 'walkout': {
      const day = findDay(state.day)
      const encounter = day?.encounters[state.index]
      if (!day || !encounter) return state
      return {
        ...state,
        phase: 'feedback',
        streak: 0,
        walkouts: state.walkouts + 1,
        usedTxIds: [...state.usedTxIds, encounter.receipt.txId],
        lastOutcome: { ...walkout(encounter), encounter },
      }
    }

    // The shift is over. Whatever is on the counter, you close up.
    case 'endDay':
      return state.phase === 'dayEnd' || state.phase === 'morning'
        ? state
        : { ...state, phase: 'dayEnd', lastOutcome: null }

    case 'next': {
      const day = findDay(state.day)
      if (!day) return state
      const nextIndex = state.index + 1
      if (nextIndex < day.encounters.length) {
        return { ...state, phase: 'serving', index: nextIndex, lastOutcome: null }
      }
      return { ...state, phase: 'dayEnd', lastOutcome: null }
    }

    case 'advanceDay': {
      const cleared = state.daysCleared + 1
      // Banked here rather than at `dayEnd`, because a day you strike out of has
      // to be replayed and only the attempt you walk away from counts.
      const dayStars = [...state.dayStars, starsToday(state)]
      if (isLastDay(state.day)) {
        return { ...state, daysCleared: cleared, dayStars, phase: 'finished' }
      }
      return {
        ...state,
        phase: 'morning',
        day: state.day + 1,
        daysCleared: cleared,
        dayStars,
        index: 0,
        earned: 0,
        strikes: 0,
        failedOut: false,
        usedTxIds: [],
        fed: [],
        lastOutcome: null,
      }
    }

    // Replaying a day rewinds everything it added, so a retried day is scored
    // once, not once per attempt.
    case 'retryDay':
      return {
        ...state,
        phase: 'morning',
        index: 0,
        earned: 0,
        strikes: 0,
        failedOut: false,
        streak: 0,
        score: state.dayStart.score,
        correct: state.dayStart.correct,
        wrong: state.dayStart.wrong,
        walkouts: state.dayStart.walkouts,
        usedTxIds: [],
        fed: [],
        lastOutcome: null,
      }

    case 'restart':
      return { ...initialState, day: startingDay(), phase: 'morning' }
  }
}

/** What today's score is worth against a flawless, instant run of today. */
export function dayCeiling(state: State): number {
  const day = findDay(state.day)
  return day ? perfectDayScore(day, state.dayStart.streak) : 0
}

export const scoredToday = (state: State) => state.score - state.dayStart.score

export const starsToday = (state: State) => starsForDay(scoredToday(state), dayCeiling(state))

/** Did the player clear rent for the day they just finished? Flavour now, not fate. */
export function madeRent(state: State): boolean {
  const day = findDay(state.day)
  return day ? state.earned >= day.rent : false
}

/** A day is survivable unless the strikes ran out. Rent no longer ends a run. */
export const survivedDay = (state: State) => !state.failedOut

export const runStats = (state: State): RunStats => ({
  score: state.score,
  maxScore: perfectScore(allDays()),
  dayStars: state.dayStars,
  dayReached: state.day,
  correct: state.correct,
  wrong: state.wrong,
  walkouts: state.walkouts,
  bestStreak: state.bestStreak,
  daysCleared: state.daysCleared,
})

export const TOTAL_DAYS = DAY_COUNT

export const isLastDay = (day: number) => day >= DAY_COUNT
