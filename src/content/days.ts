import type { DayDef, Encounter, Receipt, RuleId, Ticket } from '../game/types.ts'
import { CO_BA_STALL } from '../lib/vietqr.ts'
import { ticketTotal, type TicketLine } from './menu.ts'
import { ASSETS } from '../lib/assets.ts'
import { hashSeed, hexId, intBetween, mulberry32, sample, shuffle, type Rng } from '../lib/rng.ts'
import { CLEAN, FRAUDS, type Spec } from './pools.ts'

/**
 * The week is five days long and only the first one is written down.
 *
 * Day 1 is fixed so the tutorial always lands the same way. Days 2-5 are dealt
 * from the pools in `pools.ts` against a per-run seed, so the same rules come
 * back but never in the same order, with the same excuses, or at the same prices.
 * Day content is keyed on `hash(seed, day)` rather than one rolling stream, so
 * replaying a day after striking out deals that same day again.
 */

const STALL = CO_BA_STALL.account
const RATE = 26_300

export const TOTAL_DAYS = 5

type Plan = {
  day: number
  customers: number
  /** Rules this morning teaches. One of each is guaranteed to show up. */
  teaches: RuleId[]
  /** Frauds in the day, including one per newly taught rule. */
  frauds: number
  /** The dynamic QR machine is out, so every payer types the amount themselves. */
  stickerDay?: boolean
  intro: string
}

export const PLAN: Plan[] = [
  {
    day: 1,
    customers: 4,
    teaches: ['amount'],
    frauds: 2,
    intro:
      'First morning on your own. Grandma left you the stall and one instruction: check the amount.',
  },
  {
    day: 2,
    customers: 5,
    teaches: ['expiry', 'recipient'],
    frauds: 3,
    intro:
      'Two more things to watch. An expired receipt never settled — and the phở place two doors down has a QR sticker that looks exactly like yours.',
  },
  {
    day: 3,
    customers: 6,
    teaches: ['screenshot', 'staticQr', 'duplicate'],
    frauds: 3,
    stickerDay: true,
    intro:
      'Your QR machine died overnight, so the printed sticker carries no amount and they type it themselves. A live receipt counts down; a screenshot does not. And one receipt buys one plate — the log is on the counter.',
  },
  {
    day: 4,
    customers: 6,
    teaches: ['rate', 'bankMismatch', 'currency'],
    frauds: 3,
    intro:
      'The money itself starts lying today. The rate must match your board, the bank name must match the six digits beside it, and anything that settled outside đồng never reached you.',
  },
  {
    day: 5,
    // Six dealt plus the scripted last customer, who is always a fraud.
    customers: 6,
    teaches: [],
    frauds: 3,
    stickerDay: true,
    intro:
      'Last day, and the machine is out again — of course it is. Everything you have learned, all at once, and one person you would rather not apply it to.',
  },
]

const order = (lines: TicketLine[]): Ticket => ({ lines, total: ticketTotal(lines) })

const AXIES = Object.keys(ASSETS.axies)

/** A good, live, settled payment to us. Break exactly one field to make a fraud. */
function baseReceipt(amount: number, rate: number, txId: string, sticker: boolean): Receipt {
  return {
    status: 'sent',
    amount,
    feeVnd: amount >= 60_000 ? 1_200 : amount >= 35_000 ? 900 : 600,
    merchantName: 'Cô Ba Cơm Tấm',
    account: STALL,
    bankName: 'Vietcombank',
    bankBin: '970436',
    currency: 'VND',
    txId,
    expiresIn: 57,
    fromStaticQr: sticker,
    paidAtLabel: 'Just now',
    rate,
    usd: 0,
  }
}

function buildEncounter(
  id: string,
  axie: string,
  spec: Spec,
  violation: RuleId | null,
  rate: number,
  txId: string,
  sticker: boolean,
  rng: Rng,
): Encounter {
  const ticket = order(spec.order)
  const base = baseReceipt(ticket.total, rate, txId, sticker)
  const broken = spec.breakIt ? spec.breakIt({ total: ticket.total, rate, rng }) : {}
  const receipt: Receipt = { ...base, ...broken }
  // The dollar leg is always derived, never authored, so day 4's arithmetic can
  // only be wrong on purpose.
  receipt.usd = Math.round((receipt.amount / receipt.rate!) * 100) / 100
  return { id, axie, dialogue: spec.dialogue, ticket, receipt, violation }
}

// ---------------------------------------------------------------------------
// Day 1 — written by hand. The tutorial should never surprise anyone.
// ---------------------------------------------------------------------------
function buildDayOne(): DayDef {
  const r = mulberry32(1)
  const fixed: [string, Spec, RuleId | null, string][] = [
    [
      'buba-beast',
      { dialogue: 'One cơm tấm! I have been thinking about this since the airport.', order: [{ key: 'comtam', qty: 1 }] },
      null,
      'a91f03bc',
    ],
    [
      'olek-plant',
      {
        dialogue: 'Two cơm tấm. One for me, one for my roommate who is still asleep.',
        order: [{ key: 'comtam', qty: 2 }],
        // Typed one plate's price for two. Honest mistake, still your loss.
        breakIt: ({ total }) => ({ amount: Math.round(total / 2) }),
      },
      'amount',
      'f7e88a01',
    ],
    [
      'momo-bird',
      {
        dialogue: 'Cơm tấm and a cà phê sữa đá. Make the coffee strong.',
        order: [{ key: 'comtam', qty: 1 }, { key: 'caphe', qty: 1 }],
      },
      null,
      'c4d2119e',
    ],
    [
      'venoki-reptile',
      {
        dialogue: 'Cơm tấm, bánh mì, and a chè. I am ordering for three people, I promise.',
        order: [{ key: 'comtam', qty: 1 }, { key: 'banhmi', qty: 1 }, { key: 'che', qty: 1 }],
        breakIt: ({ total }) => ({ amount: total - 10_000 }),
      },
      'amount',
      'd0a17755',
    ],
  ]
  const encounters = fixed.map(([axie, spec, violation, txId], i) =>
    buildEncounter(`d1-${String(i + 1).padStart(2, '0')}`, axie, spec, violation, RATE, txId, false, r),
  )
  return { ...withRent(encounters), day: 1, postedRate: RATE, intro: PLAN[0].intro }
}

/**
 * Rent is a quarter of what the honest customers are worth.
 *
 * It used to be 70% and it used to be the fail condition; now it's a fixed cost
 * on a day you're trying to run at a profit. Low enough that the stall is in the
 * black on all but a disastrous day, high enough that it's a real line on the
 * ledger and a day with three scams on it can still go red.
 */
export const RENT_SHARE = 0.25

function withRent(encounters: Encounter[]) {
  const earnable = encounters
    .filter((e) => e.violation === null)
    .reduce((sum, e) => sum + e.ticket.total, 0)
  return { encounters, rent: Math.round((earnable * RENT_SHARE) / 5_000) * 5_000 }
}

/**
 * On sticker days an amount mismatch reads — and is scored — as the sticker rule,
 * so the two are one slot that picks its own name from the day.
 */
const forDay = (rule: RuleId, sticker: boolean): RuleId =>
  sticker && rule === 'amount' ? 'staticQr' : !sticker && rule === 'staticQr' ? 'amount' : rule

function buildDay(plan: Plan, seed: number): DayDef {
  const rng = mulberry32(hashSeed(seed, plan.day))
  const sticker = Boolean(plan.stickerDay)
  const postedRate = plan.day === 1 ? RATE : RATE + intBetween(rng, -30, 30) * 10

  // Everything unlocked by today, collapsed onto the slots this day can express.
  const unlocked = Array.from(
    new Set(
      PLAN.filter((p) => p.day <= plan.day)
        .flatMap((p) => p.teaches)
        .map((r) => forDay(r, sticker)),
    ),
  )

  // Each newly taught rule shows up once; the rest of the frauds are revision.
  const required = plan.teaches.map((r) => forDay(r, sticker))
  const revision = sample(
    rng,
    unlocked.filter((r) => !required.includes(r)),
    Math.max(0, plan.frauds - required.length),
  )
  const fraudRules = [...required, ...revision]

  const used = new Set<string>()
  const takeSpec = (pool: Spec[]): Spec => {
    const fresh = pool.filter((s) => !used.has(s.dialogue))
    const chosen = sample(rng, fresh.length ? fresh : pool, 1)[0]
    used.add(chosen.dialogue)
    return chosen
  }

  const drafted = [
    ...fraudRules.map((rule) => ({ rule, spec: takeSpec(FRAUDS[rule]) })),
    ...Array.from({ length: plan.customers - fraudRules.length }, () => ({
      rule: null as RuleId | null,
      spec: takeSpec(CLEAN),
    })),
  ]

  let dealt = shuffle(rng, drafted)
  // A reused transaction id needs somebody to have used it first, so the
  // duplicate can never open the day.
  if (dealt[0]?.rule === 'duplicate' && dealt.length > 1) {
    const swapWith = 1 + Math.floor(rng() * (dealt.length - 1))
    dealt = dealt.slice()
    ;[dealt[0], dealt[swapWith]] = [dealt[swapWith], dealt[0]]
  }

  const axies = sample(rng, AXIES, plan.customers)
  const txIds = new Set<string>()
  const encounters: Encounter[] = dealt.map(({ rule, spec }, i) => {
    let txId = hexId(rng)
    while (txIds.has(txId)) txId = hexId(rng)
    txIds.add(txId)
    return buildEncounter(
      `d${plan.day}-${String(i + 1).padStart(2, '0')}`,
      axies[i],
      spec,
      rule,
      postedRate,
      txId,
      sticker,
      rng,
    )
  })

  // Now that the order is fixed, point every duplicate at somebody who came before.
  encounters.forEach((e, i) => {
    if (e.violation !== 'duplicate' || i === 0) return
    const source = encounters[Math.floor(rng() * i)]
    e.receipt.txId = source.receipt.txId
  })

  if (plan.day === TOTAL_DAYS) encounters.push(finale(plan, postedRate, sticker, rng))

  return {
    ...withRent(encounters),
    day: plan.day,
    postedRate,
    stickerDay: plan.stickerDay,
    intro: plan.intro,
  }
}

/**
 * The last customer of the week, and the only scripted one after day 1. He is
 * short, he is not lying about any of it, and every rule you have says refuse.
 */
function finale(plan: Plan, rate: number, sticker: boolean, rng: Rng): Encounter {
  return buildEncounter(
    `d${plan.day}-last`,
    'olek-plant',
    {
      dialogue: 'I am nine thousand short. I have been coming here every day. Please.',
      order: [{ key: 'comtam', qty: 1 }],
      breakIt: ({ total }) => ({ amount: total - 9_000 }),
    },
    sticker ? 'staticQr' : 'amount',
    rate,
    'a07f3e55',
    sticker,
    rng,
  )
}

export function buildDays(seed: number): DayDef[] {
  return PLAN.map((plan) => (plan.day === 1 ? buildDayOne() : buildDay(plan, seed)))
}

/** `?seed=` pins a run — the sim, the audit and the screenshot harness all use it. */
function seedFromUrl(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('seed')
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : hashSeed(raw)
}

let currentSeed = seedFromUrl() ?? Math.floor(Math.random() * 2 ** 31)
let currentDays = buildDays(currentSeed)

/** Deal a fresh week. Called when a run restarts, never mid-run. */
export function rollRun(seed?: number): number {
  currentSeed = seed ?? Math.floor(Math.random() * 2 ** 31)
  currentDays = buildDays(currentSeed)
  return currentSeed
}

export const allDays = () => currentDays
export const runSeed = () => currentSeed
export const findDay = (n: number) => currentDays.find((d) => d.day === n)
