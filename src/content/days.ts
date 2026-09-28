import type { DayDef, Encounter, Receipt, Ticket } from '../game/types.ts'
import { CO_BA_STALL } from '../lib/vietqr.ts'
import { ticketTotal, type TicketLine } from './menu.ts'

const STALL = CO_BA_STALL.account
const PHO_PLACE = '1903667142' // the phở place two doors down
const BANH_MI_CART = '0071004567891'

const RATE = 26_300

/**
 * A receipt factory bound to one day's posted rate. Defaults describe a good, live,
 * settled payment to us; spread any field to break exactly one thing.
 *
 * The dollar leg is derived from the amount and the rate rather than typed, so the
 * day-7 arithmetic can never be wrong by accident — only on purpose.
 */
function mk(dayRate: number) {
  return (over: Partial<Receipt> & { amount: number; txId: string }): Receipt => {
    const rate = over.rate ?? dayRate
    return {
      status: 'sent',
      feeVnd: 1_200,
      merchantName: 'Cô Ba Cơm Tấm',
      account: STALL,
      bankName: 'Vietcombank',
      bankBin: '970436',
      currency: 'VND',
      expiresIn: 57,
      fromStaticQr: false,
      paidAtLabel: 'Just now',
      rate,
      usd: Math.round((over.amount / rate) * 100) / 100,
      ...over,
    }
  }
}

const receipt = mk(RATE)

const order = (...lines: TicketLine[]): Ticket => ({ lines, total: ticketTotal(lines) })
const n = (key: TicketLine['key'], qty = 1): TicketLine => ({ key, qty })

// Four customers a day: two genuine, two not. Short enough to demo a whole day
// in about a minute, long enough for the new rule to land twice.

// ---------------------------------------------------------------------------
// Day 1 — the amount must match the ticket
// ---------------------------------------------------------------------------
const day1: Encounter[] = [
  {
    id: 'd1-01',
    axie: 'buba-beast',
    dialogue: 'One cơm tấm! I have been thinking about this since the airport.',
    ticket: order(n('comtam')),
    receipt: receipt({ amount: 65_000, txId: 'a91f03bc' }),
    violation: null,
  },
  {
    id: 'd1-02',
    axie: 'olek-plant',
    dialogue: 'Two cơm tấm. One for me, one for my roommate who is still asleep.',
    ticket: order(n('comtam', 2)),
    // Typed one plate's price for two. Honest mistake, still your loss.
    receipt: receipt({ amount: 65_000, txId: 'f7e88a01' }),
    violation: 'amount',
  },
  {
    id: 'd1-03',
    axie: 'momo-bird',
    dialogue: 'Cơm tấm and a cà phê sữa đá. Make the coffee strong.',
    ticket: order(n('comtam'), n('caphe')),
    receipt: receipt({ amount: 85_000, txId: 'c4d2119e' }),
    violation: null,
  },
  {
    id: 'd1-04',
    axie: 'venoki-reptile',
    dialogue: 'Cơm tấm, bánh mì, and a chè. I am ordering for three people, I promise.',
    ticket: order(n('comtam'), n('banhmi'), n('che')),
    receipt: receipt({ amount: 105_000, txId: 'd0a17755' }),
    violation: 'amount',
  },
]

// ---------------------------------------------------------------------------
// Day 2 — + the receipt must still be live
// ---------------------------------------------------------------------------
const day2: Encounter[] = [
  {
    id: 'd2-01',
    axie: 'noir-aquatic',
    dialogue: 'Cơm tấm. Same as yesterday. I am becoming a regular.',
    ticket: order(n('comtam')),
    receipt: receipt({ amount: 65_000, txId: '77b1e0aa' }),
    violation: null,
  },
  {
    id: 'd2-02',
    axie: 'pomodoro-bug',
    dialogue: 'Two phở! Oh, sorry — the app was open a while ago, is that okay?',
    ticket: order(n('pho', 2)),
    receipt: receipt({
      amount: 120_000,
      txId: '9f00c1d3',
      status: 'expired',
      expiresIn: 0,
      paidAtLabel: '41 mins ago',
    }),
    violation: 'expiry',
  },
  {
    id: 'd2-03',
    axie: 'buba-beast',
    dialogue: 'Cơm tấm and a nước mía. It is five o\'clock somewhere.',
    ticket: order(n('comtam'), n('nuocmia')),
    receipt: receipt({ amount: 80_000, txId: 'e21bb845' }),
    violation: null,
  },
  {
    id: 'd2-04',
    axie: 'olek-plant',
    dialogue: 'One bánh mì. I am late for a meeting I do not want to go to.',
    ticket: order(n('banhmi')),
    receipt: receipt({
      amount: 25_000,
      txId: '4a7de113',
      status: 'expired',
      expiresIn: 0,
      paidAtLabel: '18 mins ago',
      feeVnd: 600,
    }),
    violation: 'expiry',
  },
]

// ---------------------------------------------------------------------------
// Day 3 — + it must be paid to *your* account
// ---------------------------------------------------------------------------
const day3: Encounter[] = [
  {
    id: 'd3-01',
    axie: 'xia-beast',
    dialogue: 'Cơm tấm. And whatever that smell is. Two of those.',
    ticket: order(n('comtam'), n('che', 2)),
    receipt: receipt({ amount: 115_000, txId: '1d9ab304' }),
    violation: null,
  },
  {
    id: 'd3-02',
    axie: 'venoki-reptile',
    dialogue: 'Paid! There were two QR codes on the counter so I picked one.',
    ticket: order(n('comtam')),
    receipt: receipt({
      amount: 65_000,
      txId: '6e2c7f18',
      account: PHO_PLACE,
      merchantName: 'PHO 2 THIEN',
    }),
    violation: 'recipient',
  },
  {
    id: 'd3-03',
    axie: 'buba-beast',
    dialogue: 'The usual. You know what the usual is by now, right?',
    ticket: order(n('comtam'), n('caphe')),
    receipt: receipt({ amount: 85_000, txId: '05c3daa7' }),
    violation: null,
  },
  {
    id: 'd3-04',
    axie: 'pomodoro-bug',
    dialogue: 'Bánh mì and a coffee. Your neighbour said to come here instead.',
    ticket: order(n('banhmi'), n('caphe')),
    receipt: receipt({
      amount: 45_000,
      txId: 'fb07e2c9',
      account: BANH_MI_CART,
      merchantName: 'BANH MI CO HAI',
      feeVnd: 900,
    }),
    violation: 'recipient',
  },
]

// ---------------------------------------------------------------------------
// Day 4 — + live receipt, not a screenshot
// ---------------------------------------------------------------------------
const day4: Encounter[] = [
  {
    id: 'd4-01',
    axie: 'momo-bird',
    dialogue: 'Cơm tấm please. Big one. I skipped breakfast.',
    ticket: order(n('comtam')),
    receipt: receipt({ amount: 65_000, txId: 'be91024f' }),
    violation: null,
  },
  {
    id: 'd4-02',
    axie: 'venoki-reptile',
    dialogue: 'Here, look. Paid. See? Paid. Can I take the plate?',
    ticket: order(n('comtam'), n('pho')),
    receipt: receipt({
      amount: 125_000,
      txId: 'd41c6b70',
      expiresIn: null, // frozen — it is a screenshot
    }),
    violation: 'screenshot',
  },
  {
    id: 'd4-03',
    axie: 'puffy-aquatic',
    dialogue: 'Chè. Two. It is still so hot. Does it ever stop?',
    ticket: order(n('che', 2)),
    receipt: receipt({ amount: 50_000, txId: '2f8ad916', feeVnd: 800 }),
    violation: null,
  },
  {
    id: 'd4-04',
    axie: 'xia-beast',
    dialogue: 'All paid up. My signal is terrible here so the screen is a bit stuck.',
    ticket: order(n('bun')),
    receipt: receipt({ amount: 55_000, txId: '7c05e3b1', expiresIn: null }),
    violation: 'screenshot',
  },
]

// ---------------------------------------------------------------------------
// Day 5 — the sticker day. Your dynamic QR machine broke.
// A printed VietQR carries no amount, so every customer types it themselves.
// ---------------------------------------------------------------------------
const day5: Encounter[] = [
  {
    id: 'd5-01',
    axie: 'buba-beast',
    dialogue: 'Your machine is gone! Is that a sticker? I typed it in myself.',
    ticket: order(n('comtam')),
    receipt: receipt({ amount: 65_000, txId: 'ee3401ab', fromStaticQr: true }),
    violation: null,
  },
  {
    id: 'd5-02',
    axie: 'olek-plant',
    dialogue: 'Two cơm tấm and a coffee. I typed... one fifty? One fifteen? One of those.',
    ticket: order(n('comtam', 2), n('caphe')),
    // 15,000 against 150,000. A missing zero is the classic sticker error.
    receipt: receipt({ amount: 15_000, txId: 'c7b20d84', fromStaticQr: true }),
    violation: 'staticQr',
  },
  {
    id: 'd5-03',
    axie: 'momo-bird',
    dialogue: 'Phở and a chè. The sticker is a bit faded but it scanned.',
    ticket: order(n('pho'), n('che')),
    receipt: receipt({ amount: 85_000, txId: '10ffa62d', fromStaticQr: true }),
    violation: null,
  },
  {
    id: 'd5-04',
    axie: 'noir-aquatic',
    dialogue: 'Bánh mì. I rounded down, hope that is okay. Cash economy, right?',
    ticket: order(n('banhmi', 2)),
    receipt: receipt({
      amount: 40_000,
      txId: '58e1ba07',
      fromStaticQr: true,
      feeVnd: 700,
    }),
    violation: 'staticQr',
  },
]


// ---------------------------------------------------------------------------
// Day 6 — + the transaction id must be new. Your log is on the counter.
// ---------------------------------------------------------------------------
const r6 = mk(RATE)
const day6: Encounter[] = [
  {
    id: 'd6-01',
    axie: 'xia-beast',
    dialogue: 'Cơm tấm and a phở. My brother is meeting me here, he is always late.',
    ticket: order(n('comtam'), n('pho')),
    receipt: r6({ amount: 125_000, txId: '5f10ca73' }),
    violation: null,
  },
  {
    id: 'd6-02',
    axie: 'venoki-reptile',
    dialogue: 'I am the brother. He already paid for mine, look, same screen.',
    ticket: order(n('pho')),
    // The same receipt, shown twice. One payment, two plates.
    receipt: r6({ amount: 125_000, txId: '5f10ca73' }),
    violation: 'duplicate',
  },
  {
    id: 'd6-03',
    axie: 'puffy-aquatic',
    dialogue: 'Chè and a nước mía. I am rehydrating. Sort of.',
    ticket: order(n('che'), n('nuocmia')),
    receipt: r6({ amount: 40_000, feeVnd: 700, txId: 'bb2049ef' }),
    violation: null,
  },
  {
    id: 'd6-04',
    axie: 'momo-bird',
    dialogue: 'Bánh mì. I was here an hour ago too, you might remember me.',
    ticket: order(n('banhmi')),
    receipt: r6({ amount: 25_000, feeVnd: 600, txId: 'bb2049ef' }),
    violation: 'duplicate',
  },
]

// ---------------------------------------------------------------------------
// Day 7 — + the conversion must match the rate on your board
// ---------------------------------------------------------------------------
const RATE_D7 = 26_150
const r7 = mk(RATE_D7)
const day7: Encounter[] = [
  {
    id: 'd7-01',
    axie: 'buba-beast',
    dialogue: 'Cơm tấm. The rate moved again, did you see? Everyone is complaining.',
    ticket: order(n('comtam')),
    receipt: r7({ amount: 65_000, txId: 'c001a4e2' }),
    violation: null,
  },
  {
    id: 'd7-02',
    axie: 'noir-aquatic',
    dialogue: 'Two cơm tấm. My app gave me a much better rate than your board.',
    ticket: order(n('comtam', 2)),
    // Printed rate is not the board rate. The dollars never bought that many đồng.
    receipt: r7({ amount: 130_000, rate: 31_400, txId: '7ab3e05c' }),
    violation: 'rate',
  },
  {
    id: 'd7-03',
    axie: 'olek-plant',
    dialogue: 'Bún thịt nướng and a coffee. Keep the change, there is none.',
    ticket: order(n('bun'), n('caphe')),
    receipt: r7({ amount: 75_000, txId: '1e9fd330' }),
    violation: null,
  },
  {
    id: 'd7-04',
    axie: 'pomodoro-bug',
    dialogue: 'Phở. I locked in yesterday morning, that still counts right?',
    ticket: order(n('pho')),
    receipt: r7({ amount: 60_000, rate: 24_050, txId: '90cc1b47' }),
    violation: 'rate',
  },
]

// ---------------------------------------------------------------------------
// Day 8 — + the bank name must match the code beside it
// ---------------------------------------------------------------------------
const RATE_D8 = 26_400
const r8 = mk(RATE_D8)
const day8: Encounter[] = [
  {
    id: 'd8-01',
    axie: 'momo-bird',
    dialogue: 'Cơm tấm, chè. Two of the chè. No, three. Three chè.',
    ticket: order(n('comtam'), n('che', 3)),
    receipt: r8({ amount: 140_000, txId: 'aa7701de' }),
    violation: null,
  },
  {
    id: 'd8-02',
    axie: 'venoki-reptile',
    dialogue: 'Vietcombank, same as always. Straight into your account.',
    ticket: order(n('comtam')),
    // Says Vietcombank, but 970422 is MB Bank. The name is painted on.
    receipt: r8({ amount: 65_000, bankBin: '970422', txId: '3d0be915' }),
    violation: 'bankMismatch',
  },
  {
    id: 'd8-03',
    axie: 'xia-beast',
    dialogue: 'Bún thịt nướng. I have had this every day for a week.',
    ticket: order(n('bun')),
    receipt: r8({ amount: 55_000, txId: 'ee40b2c8' }),
    violation: null,
  },
  {
    id: 'd8-04',
    axie: 'puffy-aquatic',
    dialogue: 'Bánh mì and a nước mía. Techcombank, I switched last month.',
    ticket: order(n('banhmi'), n('nuocmia')),
    receipt: r8({ amount: 40_000, bankName: 'Techcombank', feeVnd: 700, txId: '6c8a3f21' }),
    violation: 'bankMismatch',
  },
]

// ---------------------------------------------------------------------------
// Day 9 — + it has to settle in đồng
// ---------------------------------------------------------------------------
const RATE_D9 = 26_080
const r9 = mk(RATE_D9)
const day9: Encounter[] = [
  {
    id: 'd9-01',
    axie: 'buba-beast',
    dialogue: 'Cơm tấm and a cà phê. You look tired. I look tired. We are the same.',
    ticket: order(n('comtam'), n('caphe')),
    receipt: r9({ amount: 85_000, txId: 'f12c7a80' }),
    violation: null,
  },
  {
    id: 'd9-02',
    axie: 'olek-plant',
    dialogue: 'Phở. I flew in from Bangkok this morning, everything still says baht.',
    ticket: order(n('pho')),
    // Settled in baht. That money is sitting in Thailand, not your account.
    receipt: r9({ amount: 60_000, currency: 'THB', txId: 'd5591ac3' }),
    violation: 'currency',
  },
  {
    id: 'd9-03',
    axie: 'noir-aquatic',
    dialogue: 'Two cơm tấm. One is for you. You have not eaten all day, have you?',
    ticket: order(n('comtam', 2)),
    receipt: r9({ amount: 130_000, txId: '2b8e0f47' }),
    violation: null,
  },
  {
    id: 'd9-04',
    axie: 'pomodoro-bug',
    dialogue: 'Bún and a chè. It says sent, that is the important part, right?',
    ticket: order(n('bun'), n('che')),
    receipt: r9({ amount: 80_000, currency: 'USD', txId: '8f3d2c19' }),
    violation: 'currency',
  },
]

// ---------------------------------------------------------------------------
// Day 10 — no new rule. Everything at once, and one customer who deserves better.
// ---------------------------------------------------------------------------
const RATE_D10 = 26_220
const r10 = mk(RATE_D10)
const day10: Encounter[] = [
  {
    id: 'd10-01',
    axie: 'xia-beast',
    dialogue: 'Cơm tấm. Last day of my trip. I saved this one for the end.',
    ticket: order(n('comtam')),
    receipt: r10({ amount: 65_000, txId: 'ff01aa20' }),
    violation: null,
  },
  {
    id: 'd10-02',
    axie: 'venoki-reptile',
    dialogue: 'Phở and a bánh mì. Paid. Vietcombank. All good. Yes?',
    ticket: order(n('pho'), n('banhmi')),
    receipt: r10({ amount: 85_000, bankBin: '970418', txId: '4e7c9b03' }),
    violation: 'bankMismatch',
  },
  {
    id: 'd10-03',
    axie: 'puffy-aquatic',
    dialogue: 'Chè. Just chè. It has been a long ten days for both of us.',
    ticket: order(n('che')),
    receipt: r10({ amount: 25_000, feeVnd: 600, txId: '12ab98cd' }),
    violation: null,
  },
  {
    id: 'd10-04',
    axie: 'momo-bird',
    dialogue: 'Here — paid. Sorry, the screen froze, the wifi here is terrible.',
    ticket: order(n('comtam'), n('caphe')),
    receipt: r10({ amount: 85_000, expiresIn: null, txId: 'c39e01ba' }),
    violation: 'screenshot',
  },
  {
    id: 'd10-05',
    axie: 'olek-plant',
    dialogue: 'I am nine thousand short. I have been coming here every day. Please.',
    ticket: order(n('comtam')),
    // Nine thousand đồng short, and he is not lying about any of it.
    // The rules say refuse. Ten days of rules say refuse.
    receipt: r10({ amount: 56_000, txId: 'a07f3e55' }),
    violation: 'amount',
  },
]

export const DAYS: DayDef[] = [
  {
    day: 1,
    postedRate: RATE,
    rent: 105_000,
    intro:
      'First morning on your own. Grandma left you the stall and one instruction: check the amount.',
    encounters: day1,
  },
  {
    day: 2,
    postedRate: RATE,
    rent: 100_000,
    intro: 'A receipt that has expired never settled. It does not matter how sorry they look.',
    encounters: day2,
  },
  {
    day: 3,
    postedRate: RATE,
    rent: 140_000,
    intro: 'The phở place two doors down has a QR sticker too. Tourists cannot tell them apart.',
    encounters: day3,
  },
  {
    day: 4,
    postedRate: RATE,
    rent: 80_000,
    intro: 'A live receipt counts down. Anyone can screenshot one that did not.',
    encounters: day4,
  },
  {
    day: 5,
    postedRate: RATE,
    rent: 105_000,
    stickerDay: true,
    intro:
      'Your QR machine died overnight. The printed sticker carries no amount — they type it themselves.',
    encounters: day5,
  },
  {
    day: 6,
    postedRate: RATE,
    rent: 130_000,
    intro: 'One receipt, one plate. Your log is on the counter — use it.',
    encounters: day6,
  },
  {
    day: 7,
    postedRate: RATE_D7,
    rent: 100_000,
    intro: 'The board rate moved overnight. A receipt that disagrees with it is arguing with you.',
    encounters: day7,
  },
  {
    day: 8,
    postedRate: RATE_D8,
    rent: 140_000,
    intro: 'Anyone can print a bank name. The six digits beside it are harder to fake.',
    encounters: day8,
  },
  {
    day: 9,
    postedRate: RATE_D9,
    rent: 155_000,
    intro: 'It can say sent and still be sitting in another country, in another currency.',
    encounters: day9,
  },
  {
    day: 10,
    postedRate: RATE_D10,
    rent: 65_000,
    intro: 'Last day. Everything you have learned, and one person you would rather not apply it to.',
    encounters: day10,
  },
]

export const findDay = (n: number) => DAYS.find((d) => d.day === n)
