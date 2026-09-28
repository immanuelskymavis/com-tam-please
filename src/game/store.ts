import type { CallOutcome } from './validate.ts'
import { resolveCall, walkout } from './validate.ts'
import { DAYS, findDay } from '../content/days.ts'
import { heroDish } from '../content/menu.ts'
import type { Encounter } from './types.ts'

export type Phase = 'title' | 'morning' | 'serving' | 'feedback' | 'dayEnd' | 'gameOver' | 'finished'

export type State = {
  phase: Phase
  day: number
  index: number
  /** Đồng earned today, reset each morning. Rent is a daily target, not a bank balance. */
  earned: number
  reputation: number
  /** Transaction ids seen today. Resets each morning. */
  usedTxIds: string[]
  /**
   * Who actually walked away with food today, and what they got. Refused and
   * walked-out customers are absent — they have nothing to sit and eat.
   */
  fed: { axie: string; dish: string }[]
  lastOutcome: (CallOutcome & { encounter: Encounter }) | null
}

const REPUTATION_LIMIT = 3
const REPUTATION_FINE = 100_000

/**
 * Demo jumps, read from the query string:
 *   ?day=5     open on day 5 (the sticker day — the rule worth showing)
 *   ?day=5&c=2 open on day 5 and go straight to its 2nd customer, skipping the cards
 * Nobody demoing wants to play four days to reach the interesting rule.
 */
function params(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
}

function startingDay(): number {
  const asked = Number(params().get('day'))
  if (!Number.isInteger(asked)) return 1
  return DAYS.some((d) => d.day === asked) ? asked : 1
}

/** 1-based customer in the query string; 0-based index internally. null = start of day. */
function startingIndex(day: number): number | null {
  const raw = params().get('c')
  if (raw === null) return null
  const asked = Number(raw)
  const found = DAYS.find((d) => d.day === day)
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
  reputation: 0,
  usedTxIds: [],
  fed: [],
  lastOutcome: null,
}

export type Action =
  | { type: 'start' }
  | { type: 'beginDay' }
  | { type: 'call'; served: boolean }
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

      let reputation = state.reputation + outcome.reputationDelta
      let earned = state.earned + outcome.moneyDelta

      // Three strikes and the fine lands immediately, then the counter resets.
      if (reputation >= REPUTATION_LIMIT) {
        earned -= REPUTATION_FINE
        reputation = 0
      }

      // Handing the plate over feeds them whether or not the payment was real —
      // being scammed still costs you a plate of food.
      const gotFood = outcome.reaction === 'served' || outcome.reaction === 'scammedYou'

      return {
        ...state,
        phase: 'feedback',
        earned,
        reputation,
        usedTxIds: [...state.usedTxIds, encounter.receipt.txId],
        fed: gotFood
          ? [...state.fed, { axie: encounter.axie, dish: heroDish(encounter.ticket.lines).image }]
          : state.fed,
        lastOutcome: { ...outcome, encounter },
      }
    }

    case 'walkout': {
      const day = findDay(state.day)
      const encounter = day?.encounters[state.index]
      if (!day || !encounter) return state
      return {
        ...state,
        phase: 'feedback',
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
      if (isLastDay(state.day)) return { ...state, phase: 'finished' }
      return {
        ...state,
        phase: 'morning',
        day: state.day + 1,
        index: 0,
        earned: 0,
        usedTxIds: [],
        fed: [],
        lastOutcome: null,
      }
    }

    case 'retryDay':
      return {
        ...state,
        phase: 'morning',
        index: 0,
        earned: 0,
        usedTxIds: [],
        fed: [],
        lastOutcome: null,
      }

    case 'restart':
      return { ...initialState, day: startingDay(), phase: 'morning' }
  }
}

/** Did the player clear rent for the day they just finished? */
export function madeRent(state: State): boolean {
  const day = findDay(state.day)
  return day ? state.earned >= day.rent : false
}

export const isLastDay = (day: number) => day >= DAYS[DAYS.length - 1].day
