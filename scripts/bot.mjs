/**
 * The reference player, as a function that runs inside the page.
 *
 * It exists because the week is dealt at runtime: a harness can no longer assume
 * "customer 2 on day 4 is the bad one" and hardcode a click. This reads the same
 * surfaces a human reads — the POS total, the phone, the board, the log spike —
 * and applies all nine rules, so a screenshot run or an interaction test can play
 * a real week without knowing what was dealt.
 *
 * Returns 'serve' | 'refuse', plus the reason it refused, which is what makes a
 * failure legible instead of just wrong.
 */
export function decide() {
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? ''
  const digits = (s) => s.replace(/[^0-9]/g, '')
  const row = (label) =>
    [...document.querySelectorAll('.receipt__row')]
      .find((r) => r.querySelector('dt')?.textContent?.trim() === label)
      ?.querySelector('dd')
      ?.textContent?.trim() ?? ''

  // amount must equal the ticket (and on sticker days, the typed amount is theirs)
  if (digits(text('.receipt__amount')) !== digits(text('.pos__total span:last-child'))) {
    return { call: 'refuse', why: 'amount' }
  }
  // a screenshot does not count down
  if (!document.querySelector('.receipt__pulse')) return { call: 'refuse', why: 'screenshot' }
  // an expired receipt never settled
  if (document.querySelector('.receipt')?.className.includes('receipt--bad')) {
    return { call: 'refuse', why: 'expiry' }
  }
  // it has to have reached our account
  if (!row('Account').includes('1017286654')) return { call: 'refuse', why: 'recipient' }
  // anything that settled outside đồng is somewhere else
  if (document.querySelector('.receipt__row--flag')) return { call: 'refuse', why: 'currency' }
  // the printed bank name has to be the one that BIN belongs to
  const bank = row('Bank')
  if (!/^Vietcombank/.test(bank) || !bank.includes('970436')) {
    return { call: 'refuse', why: 'bankMismatch' }
  }
  // the rate has to be the one on the board
  const printed = digits(row('Exchange rate'))
  const board = digits(text('.board__row--rate .board__v'))
  if (printed && board && printed !== board) return { call: 'refuse', why: 'rate' }
  // one receipt, one plate
  const tx = row('Transaction')
  const seen = [...document.querySelectorAll('.deskLog li')].map((li) => li.textContent?.trim())
  if (tx && seen.includes(tx)) return { call: 'refuse', why: 'duplicate' }

  return { call: 'serve', why: null }
}
