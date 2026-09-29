import type { Receipt, RuleId } from '../game/types.ts'
import type { TicketLine } from './menu.ts'
import { intBetween, pick, type Rng } from '../lib/rng.ts'

/**
 * The raw material the day generator deals from.
 *
 * A spec is one customer: what they say and what they ordered. A fraud spec also
 * carries `breakIt`, which returns the receipt fields that make it wrong — exactly
 * one thing, so the tell the dialogue hints at is the tell the validator finds.
 */
export type BreakCtx = { total: number; rate: number; rng: Rng }
export type Spec = {
  dialogue: string
  order: TicketLine[]
  breakIt?: (ctx: BreakCtx) => Partial<Receipt>
}

const n = (key: TicketLine['key'], qty = 1): TicketLine => ({ key, qty })

/** Other people's accounts. All deliberately fake — never a real one. */
export const PHO_PLACE = '1903667142'
export const BANH_MI_CART = '0071004567891'
export const JUICE_CART = '0601009933412'

// ---------------------------------------------------------------------------
// Honest customers. These outnumber any single fraud type, so a clean receipt
// never reads as "the one I haven't seen before".
// ---------------------------------------------------------------------------
export const CLEAN: Spec[] = [
  { dialogue: 'One cơm tấm. I have been thinking about this since the airport.', order: [n('comtam')] },
  { dialogue: 'Cơm tấm and a cà phê sữa đá. Make the coffee strong.', order: [n('comtam'), n('caphe')] },
  { dialogue: 'The usual. You know what the usual is by now, right?', order: [n('comtam'), n('caphe')] },
  { dialogue: 'Cơm tấm and a nước mía. It is five o’clock somewhere.', order: [n('comtam'), n('nuocmia')] },
  { dialogue: 'Two cơm tấm. One is for you. You have not eaten all day, have you?', order: [n('comtam', 2)] },
  { dialogue: 'Phở. Extra herbs if you have them. I am fighting something off.', order: [n('pho')] },
  { dialogue: 'Phở and a chè. My physio would have opinions about this.', order: [n('pho'), n('che')] },
  { dialogue: 'Bún thịt nướng. I have had this every day for a week.', order: [n('bun')] },
  { dialogue: 'Bún and a cà phê. Keep the change, there is none.', order: [n('bun'), n('caphe')] },
  { dialogue: 'Bánh mì. I am late for a meeting I do not want to go to.', order: [n('banhmi')] },
  { dialogue: 'Two bánh mì. One now, one for the bus. Do not judge me.', order: [n('banhmi', 2)] },
  { dialogue: 'Chè. Two. It is still so hot. Does it ever stop?', order: [n('che', 2)] },
  { dialogue: 'Chè and a nước mía. I am rehydrating. Sort of.', order: [n('che'), n('nuocmia')] },
  { dialogue: 'Cơm tấm, and whatever that smell is. Two of those.', order: [n('comtam'), n('che', 2)] },
  { dialogue: 'Cơm tấm, chè, chè. No — three chè. Three.', order: [n('comtam'), n('che', 3)] },
  { dialogue: 'Phở and a bánh mì. I am carb-loading for absolutely nothing.', order: [n('pho'), n('banhmi')] },
]

/** Knock a plausible amount off the total without ever landing back on it. */
const shortBy = ({ total, rng }: BreakCtx) => {
  const gap = pick(rng, [5_000, 9_000, 10_000, 15_000, 20_000, 25_000])
  return { amount: Math.max(5_000, total - (gap >= total ? 5_000 : gap)) }
}

// ---------------------------------------------------------------------------
// One pool per rule. Each entry's dialogue is the excuse; `breakIt` is the truth.
// ---------------------------------------------------------------------------
export const FRAUDS: Record<RuleId, Spec[]> = {
  amount: [
    {
      dialogue: 'Two cơm tấm. One for me, one for my roommate who is still asleep.',
      order: [n('comtam', 2)],
      breakIt: ({ total }) => ({ amount: Math.round(total / 2) }),
    },
    {
      dialogue: 'Cơm tấm, bánh mì, and a chè. I am ordering for three people, I promise.',
      order: [n('comtam'), n('banhmi'), n('che')],
      breakIt: shortBy,
    },
    {
      dialogue: 'Phở and a coffee. That is what it said on the screen, I just tapped it.',
      order: [n('pho'), n('caphe')],
      breakIt: shortBy,
    },
    {
      dialogue: 'Bún and two chè. Is it not the same price as yesterday?',
      order: [n('bun'), n('che', 2)],
      breakIt: shortBy,
    },
  ],

  expiry: [
    {
      dialogue: 'Two phở! Oh, sorry — the app was open a while ago, is that okay?',
      order: [n('pho', 2)],
      breakIt: ({ rng }) => ({
        status: 'expired' as const,
        expiresIn: 0,
        paidAtLabel: `${intBetween(rng, 22, 48)} mins ago`,
      }),
    },
    {
      dialogue: 'I queued at the phở place first, then came here. Same payment though.',
      order: [n('comtam'), n('nuocmia')],
      breakIt: ({ rng }) => ({
        status: 'expired' as const,
        expiresIn: 0,
        paidAtLabel: `${intBetween(rng, 12, 20)} mins ago`,
      }),
    },
    {
      dialogue: 'It said sent ages ago. Ages. Does that not just... stay sent?',
      order: [n('banhmi'), n('caphe')],
      breakIt: ({ rng }) => ({
        status: 'expired' as const,
        expiresIn: 0,
        paidAtLabel: `${intBetween(rng, 50, 90)} mins ago`,
      }),
    },
  ],

  recipient: [
    {
      dialogue: 'Paid! There were two QR codes on the counter so I picked one.',
      order: [n('comtam')],
      breakIt: () => ({ account: PHO_PLACE, merchantName: 'PHO 2 THIEN' }),
    },
    {
      dialogue: 'Bánh mì and a coffee. Your neighbour said to come here instead.',
      order: [n('banhmi'), n('caphe')],
      breakIt: () => ({ account: BANH_MI_CART, merchantName: 'BANH MI CO HAI' }),
    },
    {
      dialogue: 'Nước mía and a chè. I scanned the big sticker, the shiny one.',
      order: [n('nuocmia'), n('che')],
      breakIt: () => ({ account: JUICE_CART, merchantName: 'NUOC MIA 88' }),
    },
  ],

  screenshot: [
    {
      dialogue: 'Here, look. Paid. See? Paid. Can I take the plate?',
      order: [n('comtam'), n('pho')],
      breakIt: () => ({ expiresIn: null }),
    },
    {
      dialogue: 'All paid up. My signal is terrible here so the screen is a bit stuck.',
      order: [n('bun')],
      breakIt: () => ({ expiresIn: null }),
    },
    {
      dialogue: 'Sorry — the screen froze. The wifi on this street is a war crime.',
      order: [n('comtam'), n('caphe')],
      breakIt: () => ({ expiresIn: null }),
    },
  ],

  staticQr: [
    {
      dialogue: 'Two cơm tấm and a coffee. I typed... one fifty? One fifteen? One of those.',
      order: [n('comtam', 2), n('caphe')],
      breakIt: ({ total }) => ({ amount: Math.round(total / 10 / 1_000) * 1_000 }),
    },
    {
      dialogue: 'Bánh mì. I rounded down, hope that is okay. Cash economy, right?',
      order: [n('banhmi', 2)],
      breakIt: shortBy,
    },
    {
      dialogue: 'I typed it in myself. Maths has never been my strongest area.',
      order: [n('pho'), n('che')],
      breakIt: ({ total }) => ({ amount: Math.round(total / 10 / 1_000) * 1_000 }),
    },
    {
      dialogue: 'Phở and a bún. There is no amount on your sticker so I guessed.',
      order: [n('pho'), n('bun')],
      breakIt: shortBy,
    },
  ],

  duplicate: [
    // The generator overwrites txId with an earlier customer's — that is the whole tell.
    { dialogue: 'I am the brother. He already paid for mine, look, same screen.', order: [n('pho')] },
    { dialogue: 'Bánh mì. I was here an hour ago too, you might remember me.', order: [n('banhmi')] },
    { dialogue: 'Same code as my friend. We are splitting it, sort of. Kind of.', order: [n('che'), n('caphe')] },
  ],

  rate: [
    {
      dialogue: 'Two cơm tấm. My app gave me a much better rate than your board.',
      order: [n('comtam', 2)],
      breakIt: ({ rate, rng }) => ({ rate: rate + intBetween(rng, 3_000, 6_000) }),
    },
    {
      dialogue: 'Phở. I locked in yesterday morning, that still counts right?',
      order: [n('pho')],
      breakIt: ({ rate, rng }) => ({ rate: rate - intBetween(rng, 2_000, 5_000) }),
    },
    {
      dialogue: 'Cơm tấm and a chè. The airport gave me this rate, it is official.',
      order: [n('comtam'), n('che')],
      breakIt: ({ rate, rng }) => ({ rate: rate + intBetween(rng, 2_500, 4_500) }),
    },
  ],

  bankMismatch: [
    {
      dialogue: 'Vietcombank, same as always. Straight into your account.',
      order: [n('comtam')],
      breakIt: ({ rng }) => ({ bankBin: pick(rng, ['970422', '970418', '970415']) }),
    },
    {
      dialogue: 'Bánh mì and a nước mía. Techcombank, I switched last month.',
      order: [n('banhmi'), n('nuocmia')],
      breakIt: () => ({ bankName: 'Techcombank' }),
    },
    {
      dialogue: 'Bún thịt nướng. It went through ACB, that is the same network.',
      order: [n('bun')],
      breakIt: () => ({ bankName: 'ACB' }),
    },
  ],

  currency: [
    {
      dialogue: 'Phở. I flew in from Bangkok this morning, everything still says baht.',
      order: [n('pho')],
      breakIt: () => ({ currency: 'THB' }),
    },
    {
      dialogue: 'Bún and a chè. It says sent, that is the important part, right?',
      order: [n('bun'), n('che')],
      breakIt: () => ({ currency: 'USD' }),
    },
    {
      dialogue: 'Cơm tấm. My bank is in Singapore, it sorts itself out on their end.',
      order: [n('comtam')],
      breakIt: () => ({ currency: 'SGD' }),
    },
  ],
}
