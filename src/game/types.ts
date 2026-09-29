/** Rule ids, in the order the days unlock them. */
export type RuleId =
  | 'amount'      // day 1 — amount must equal the ticket total
  | 'expiry'      // day 2 — receipt must be live, not expired
  | 'recipient'   // day 2 — must be paid to *your* account
  | 'screenshot'  // day 3 — live receipt, not a frozen screenshot
  | 'staticQr'    // day 3 — static-sticker days: customer typed the amount
  | 'duplicate'   // day 3 — transaction id already used today
  | 'rate'        // day 4 — conversion must match the posted rate
  | 'bankMismatch'// day 4 — the bank name must match its BIN
  | 'currency'    // day 4 — must settle in đồng

export type Rule = {
  id: RuleId
  day: number
  /** Shown in the on-counter rules panel. Imperative, scannable. */
  label: string
  /** The tell, in the player's own words. */
  hint: string
}

export const RULES: Rule[] = [
  {
    id: 'amount',
    day: 1,
    label: 'Amount must match the ticket',
    hint: 'Compare the receipt amount to what they actually ordered',
  },
  {
    id: 'expiry',
    day: 2,
    label: 'Receipt must still be live',
    hint: 'An expired receipt means the payment never settled',
  },
  {
    id: 'recipient',
    day: 2,
    label: 'Paid to Cô Ba, account 1017286654',
    hint: 'Tourists sometimes scan the phở place two doors down',
  },
  {
    id: 'screenshot',
    day: 3,
    label: 'Live receipt, not a screenshot',
    hint: 'A live receipt counts down. A screenshot is frozen',
  },
  {
    id: 'staticQr',
    day: 3,
    label: 'Sticker days: check the typed amount',
    hint: 'A printed QR carries no amount, so they type it themselves',
  },
  {
    id: 'duplicate',
    day: 3,
    label: 'Transaction ID must be new',
    hint: 'Check it against the log — one receipt, one plate',
  },
  {
    id: 'rate',
    day: 4,
    label: 'Rate must match the board',
    hint: 'Do the maths: dollars × posted rate should equal the đồng',
  },
  {
    id: 'bankMismatch',
    day: 4,
    label: 'Bank name must match its code',
    hint: '970436 is Vietcombank. Check the code against the name',
  },
  {
    id: 'currency',
    day: 4,
    label: 'Must settle in đồng',
    hint: 'A receipt settled in another currency never reached your account',
  },
]

export const rulesForDay = (day: number) => RULES.filter((r) => r.day <= day)

/** Everything this morning's card has to teach. Days 2-4 unlock two or three at once. */
export const newRulesForDay = (day: number) => RULES.filter((r) => r.day === day)

/** Seconds one customer will wait before giving up. Tightens as the days get harder. */
export const patienceForDay = (day: number) => Math.max(22, 42 - (day - 1) * 4)

/**
 * Seconds in a whole shift. Generous enough to inspect every receipt properly,
 * tight enough that dithering on all four costs you the day.
 */
export const shiftForDay = (day: number, customers: number) =>
  Math.round(customers * patienceForDay(day) * 0.8)

import type { TicketLine } from '../content/menu.ts'

/** The receipt panel's own state, mirroring the real PayMoji screen. */
export type ReceiptStatus = 'sent' | 'onItsWay' | 'expired'

export type Receipt = {
  status: ReceiptStatus
  /** Đồng actually sent. */
  amount: number
  feeVnd: number
  /** Source-currency leg. Present when they topped up in USD. */
  usd?: number
  /** Đồng per USD as printed on the receipt. */
  rate?: number
  merchantName: string
  account: string
  /** Bank name as printed on the receipt. May lie about the BIN beside it. */
  bankName: string
  /** The 6-digit NAPAS bank code the payment actually went through. */
  bankBin: string
  /** ISO code the payment settled in. Anything but VND never reached you. */
  currency: string
  txId: string
  /** Seconds left on the live countdown. null = frozen (a screenshot). */
  expiresIn: number | null
  /** True when this came from the printed sticker, so the payer typed the amount. */
  fromStaticQr: boolean
  paidAtLabel: string
}

export type Ticket = {
  lines: TicketLine[]
  /** Computed from the lines, never authored. */
  total: number
}

export type Encounter = {
  id: string
  axie: string
  dialogue: string
  ticket: Ticket
  receipt: Receipt
  /** Ground truth. null = this payment is good and should be served. */
  violation: RuleId | null
}

export type DayDef = {
  day: number
  /** Đồng per USD, posted on the stall's board that morning. */
  postedRate: number
  rent: number
  /** Set on the day the dynamic QR machine breaks. */
  stickerDay?: boolean
  /** Shown on the morning card. */
  intro: string
  encounters: Encounter[]
}
