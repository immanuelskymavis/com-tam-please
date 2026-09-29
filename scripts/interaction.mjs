/**
 * Exercises the physical interactions: hand the plate across to serve, drop the
 * DENIED stamp on the phone to refuse, and let patience run out to trigger a walkout.
 *
 *   node scripts/interaction.mjs
 */
import puppeteer from 'puppeteer-core'
import { decide } from './bot.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:5177'
// Days 2-5 are dealt at runtime, so every test pins the same week. Day 1 is
// written by hand and identical on every seed.
const SEED = 'seed=1'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  defaultViewport: { width: 1280, height: 800 },
})

const centre = async (page, selector) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }
  }, selector)

/** Drag with intermediate moves — one jump would skip the pointermove handler. */
async function dragTo(page, fromSel, toSel) {
  const from = await centre(page, fromSel)
  const to = await centre(page, toSel)
  if (!from || !to) throw new Error(`missing ${!from ? fromSel : toSel}`)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await new Promise((r) => setTimeout(r, 22))
  }
  await page.mouse.up()
}

/**
 * Play by the rules until `stop` says we're there (or we run out of patience with
 * it). Clicks whatever card button is in front of it, so it walks day to day.
 */
async function playUntil(page, stop, steps = 80) {
  for (let i = 0; i < steps; i++) {
    if (await page.evaluate(stop)) return true
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /next customer|finish the week|lock up|open up again|start the day/i.test(
          b.textContent ?? '',
        ),
      )
      if (!btn) return false
      btn.click()
      return true
    })
    if (!clicked) {
      // The shift clock can close the day between the read and the drag, taking
      // the desk with it. That's the game working, not a failure — try again.
      try {
        const { call: verdictCall } = await call(page)
        if (verdictCall === 'serve') await dragTo(page, '.tool--plate', '.booth__hatch')
        else await dragTo(page, '.tool--stamp', '.desk__phone')
      } catch {
        /* the counter went away mid-step */
      }
    }
    await new Promise((r) => setTimeout(r, 260))
  }
  return page.evaluate(stop)
}

/** What the reference player would do with whatever is on the counter right now. */
const call = (page) => page.evaluate(new Function(`return (${decide.toString()})()`))

const open = async (url) => {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}${url}${url.includes('?') ? '&' : '?'}${SEED}`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(
    () => document.querySelector('.axie-stage')?.dataset.stage === 'ready',
    { timeout: 25_000 },
  )
  return { page, errors }
}

const verdict = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.citation')
    if (!c) return null
    return {
      head: c.querySelector('.citation__head')?.textContent?.trim(),
      body: c.querySelector('.citation__body strong')?.textContent?.trim(),
      kind: c.className.includes('is-citation')
        ? 'citation'
        : c.className.includes('is-walkout')
          ? 'walkout'
          : 'clear',
    }
  })

let failures = 0
const check = (name, got, want) => {
  const ok = got && got.head === want.head && got.kind === want.kind
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(42)} ${got ? `${got.kind}/${got.head}` : 'no verdict'}`)
  if (!ok) failures++
}

// 1. Hand the plate over for a genuine payment.
{
  const { page, errors } = await open('/?day=1&c=1')
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 400))
  check('drag plate to hatch → serves', await verdict(page), { head: 'Paid in full', kind: 'clear' })
  if (errors.length) { console.log(`    page error: ${errors[0]}`); failures++ }
  await page.close()
}

// 2. Stamp the phone on an underpayment.
{
  const { page } = await open('/?day=1&c=2')
  await dragTo(page, '.tool--stamp', '.desk__phone')
  await new Promise((r) => setTimeout(r, 400))
  check('drag stamp to phone → refuses', await verdict(page), { head: 'Good catch', kind: 'clear' })
  await page.close()
}

// 3. Serving a bad payment should cite you.
{
  const { page } = await open('/?day=1&c=2')
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 400))
  check('serving a bad payment → citation', await verdict(page), { head: 'Citation', kind: 'citation' })
  await page.close()
}

// 4. Dropping the plate somewhere meaningless must do nothing.
{
  const { page } = await open('/?day=1&c=1')
  await dragTo(page, '.tool--plate', '.pos')
  await new Promise((r) => setTimeout(r, 400))
  const v = await verdict(page)
  const ok = v === null
  console.log(`  ${ok ? '✓' : '✗'} ${'drop on the POS → nothing happens'.padEnd(42)} ${v ? 'fired anyway' : 'no verdict'}`)
  if (!ok) failures++
  await page.close()
}

// 5. Patience runs out on its own.
{
  const { page } = await open('/?day=5&c=1')
  const walked = await page
    .waitForFunction(() => document.querySelector('.citation.is-walkout') !== null, {
      timeout: 30_000,
    })
    .then(() => true)
    .catch(() => false)
  console.log(`  ${walked ? '✓' : '✗'} ${'patience runs out → walkout'.padEnd(42)} ${walked ? 'left' : 'never left'}`)
  if (!walked) failures++
  await page.close()
}

// 6. Only people who actually got food sit down outside, eating what they ordered.
{
  const { page } = await open('/?day=4&c=1')
  const next = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent?.trim().toLowerCase() === 'next customer')
        ?.click(),
    )
  // The week is dealt, so play three customers by the rules and record what the
  // reference player did rather than assuming who is who.
  const fed = []
  for (let i = 0; i < 3; i++) {
    const { call: verdictCall } = await call(page)
    const dish = await page.evaluate(
      () => document.querySelector('.tool--plate img')?.getAttribute('src')?.split('/').pop() ?? '',
    )
    if (verdictCall === 'serve') {
      fed.push(dish)
      await dragTo(page, '.tool--plate', '.booth__hatch')
    } else {
      await dragTo(page, '.tool--stamp', '.desk__phone')
    }
    await new Promise((r) => setTimeout(r, 600))
    await next()
    await new Promise((r) => setTimeout(r, 900))
  }

  const street = await page.evaluate(() => ({
    stools: document.querySelectorAll('.stool').length,
    // Compare filenames, not paths — the deployed build serves assets under a
    // base prefix (/<repo>/) that the local dev server doesn't have.
    dishes: [...document.querySelectorAll('.stoolDish')].map((d) =>
      d.getAttribute('src').split('/').pop(),
    ),
  }))
  const ok =
    street.stools === fed.length &&
    fed.length > 0 &&
    [...street.dishes].sort().join() === [...fed].sort().join()
  console.log(
    `  ${ok ? '✓' : '✗'} ${'only served customers sit down'.padEnd(42)} ` +
      `served ${fed.length}, seated ${street.stools} (${street.dishes.join(' + ') || 'none'})`,
  )
  if (!ok) failures++
  await page.close()
}

// 7. One mistake must not end the day — that was the whole point of the rebalance.
{
  const { page } = await open('/?day=1&c=1')
  const next = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent?.trim().toLowerCase() === 'next customer')
        ?.click(),
    )
  // c1 is genuine; stamping it is a wrong refusal → strike 1.
  await dragTo(page, '.tool--stamp', '.desk__phone')
  await new Promise((r) => setTimeout(r, 600))
  await next()
  await new Promise((r) => setTimeout(r, 900))
  const stillPlaying = await page.evaluate(() => ({
    onCounter: !!document.querySelector('.booth'),
    strikes: document.querySelectorAll('.board__strikes .dot.is-on').length,
  }))
  const ok = stillPlaying.onCounter && stillPlaying.strikes === 1
  console.log(
    `  ${ok ? '✓' : '✗'} ${'one mistake keeps the day alive'.padEnd(42)} ` +
      `${stillPlaying.strikes} strike, still serving: ${stillPlaying.onCounter}`,
  )
  if (!ok) failures++
  await page.close()
}

// 8. Three mistakes closes the stall.
{
  const { page } = await open('/?day=1&c=1')
  const next = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent?.trim().toLowerCase() === 'next customer')
        ?.click(),
    )
  // Day 1 runs good / bad / good / bad, so: refuse, serve, refuse = three wrong.
  await dragTo(page, '.tool--stamp', '.desk__phone')
  await new Promise((r) => setTimeout(r, 550)); await next(); await new Promise((r) => setTimeout(r, 800))
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 550)); await next(); await new Promise((r) => setTimeout(r, 800))
  await dragTo(page, '.tool--stamp', '.desk__phone')
  await new Promise((r) => setTimeout(r, 1200))

  const struck = await page.evaluate(() => {
    const title = document.querySelector('.card__title')?.textContent ?? ''
    return { onLedger: !!document.querySelector('.ledger'), title }
  })
  const ok = struck.onLedger && /three strikes/i.test(struck.title)
  console.log(
    `  ${ok ? '✓' : '✗'} ${'three mistakes closes the day'.padEnd(42)} ${struck.title || '(no card)'}`,
  )
  if (!ok) failures++
  await page.close()
}

// 9. The running total climbs, and a streak multiplies it.
{
  const { page } = await open('/?day=1&c=1')
  const read = () =>
    page.evaluate(() => {
      const el = document.querySelector('.takings__value')
      return Number((el?.textContent ?? '0').replace(/[^0-9-]/g, ''))
    })
  // The day opens in the red — rent comes out when the shutters go up — so the
  // counter has to climb out of that hole, not up from zero.
  const rent = await page.evaluate(
    () => Number((document.querySelectorAll('.board__row--paid .board__v')[0]?.textContent ?? '0').replace(/[^0-9]/g, '')),
  )
  const before = await read()
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 1400))
  const after = await read()
  const bonus = await page.evaluate(
    () => Number((document.querySelector('.board__v.is-bonus')?.textContent ?? '0').replace(/[^0-9]/g, '')),
  )
  const ok = rent > 0 && before === -rent && after > before && bonus > 0
  console.log(
    `  ${ok ? '✓' : '✗'} ${'week total climbs out of the rent'.padEnd(42)} ` +
      `${before} → ${after} (rent ${rent}, paymoji bonus ${bonus})`,
  )
  if (!ok) failures++
  await page.close()
}

// 10. The stage timeline says where you are and moves on when the day closes.
{
  const { page } = await open('/?day=3&c=1')
  const read = () =>
    page.evaluate(() => {
      const t = document.querySelector('.track--compact')
      if (!t) return null
      return {
        stages: t.querySelectorAll('.track__node').length,
        here: t.querySelector('.track__stage.is-here .track__node')?.textContent,
        done: t.querySelectorAll('.track__stage.is-done').length,
        caption: t.querySelector('.track__caption')?.textContent?.trim(),
      }
    })
  const track = await read()
  const ok = track && track.stages === 5 && track.here === '3' && track.caption === 'DAY 3 / 5'
  console.log(
    `  ${ok ? '✓' : '✗'} ${'timeline shows the day out of five'.padEnd(42)} ` +
      `${track ? `${track.caption}, on stage ${track.here}` : 'no timeline'}`,
  )
  if (!ok) failures++
  await page.close()
}

// 11. Finishing lands on the star screen, and the stars agree with the meter.
//     (This jumps straight to day 5, so the score is one day out of five and
//     the honest answer really is no stars — what's checked is the agreement.)
{
  const { page } = await open('/?day=5&c=1')
  for (let step = 0; step < 60; step++) {
    const done = await page.evaluate(() => {
      if (document.querySelector('.summary')) return true
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /next customer|finish the week|lock up|open up again|start the day/i.test(b.textContent ?? ''),
      )
      if (btn) { btn.click(); return false }
      return null
    })
    if (done === true) break
    if (done === null) {
      // The shift clock can close the day between the read and the drag, taking
      // the desk with it. That's the game working, not a failure — try again.
      try {
        const { call: verdictCall } = await call(page)
        if (verdictCall === 'serve') await dragTo(page, '.tool--plate', '.booth__hatch')
        else await dragTo(page, '.tool--stamp', '.desk__phone')
      } catch {
        /* the counter went away mid-step */
      }
    }
    await new Promise((r) => setTimeout(r, 260))
  }
  await new Promise((r) => setTimeout(r, 1500))
  const end = await page.evaluate(() => {
    const el = document.querySelector('.summary')
    if (!el) return null
    return {
      won: el.querySelectorAll('.stars__s.is-won').length,
      slots: el.querySelectorAll('.stars__s').length,
      meter: el.querySelector('.summary__meterCap')?.textContent?.trim() ?? '',
      total: el.querySelector('.summary__totalNum')?.textContent?.trim() ?? '',
    }
  })
  const pct = end ? Number(end.meter.match(/(\d+)%/)?.[1] ?? -1) : -1
  const expected = pct >= 70 ? 3 : pct >= 45 ? 2 : pct >= 20 ? 1 : 0
  const ok =
    end && end.slots === 3 && pct >= 0 && end.won === expected && Number(end.total.replace(/\D/g, '')) > 0
  console.log(
    `  ${ok ? '✓' : '✗'} ${'stars agree with the score meter'.padEnd(42)} ` +
      `${end ? `${end.won}/3 at ${pct}%, ${end.total} ₫` : 'never got there'}`,
  )
  if (!ok) failures++
  await page.close()
}

// 12. A day played clean is rated three stars on its own closing card.
{
  const { page } = await open('/?day=1&c=1')
  await playUntil(page, () => !!document.querySelector('.dayStars'))
  await new Promise((r) => setTimeout(r, 900))
  const card = await page.evaluate(() => {
    const el = document.querySelector('.dayStars')
    if (!el) return null
    return {
      won: el.querySelectorAll('.dayStars__s.is-won').length,
      slots: el.querySelectorAll('.dayStars__s').length,
      caption: el.querySelector('em')?.textContent?.trim() ?? '',
    }
  })
  const ok = card && card.slots === 3 && card.won === 3 && /% of a perfect day/.test(card.caption)
  console.log(
    `  ${ok ? '✓' : '✗'} ${'a clean day is three stars'.padEnd(42)} ` +
      `${card ? `${card.won}/3, ${card.caption}` : 'no day rating'}`,
  )
  if (!ok) failures++
  await page.close()
}

// 12b. The closing ledger has to add up: profit + PayMoji bonus = your salary.
{
  const { page } = await open('/?day=1&c=1')
  await playUntil(page, () => !!document.querySelector('.dayStars'))
  await new Promise((r) => setTimeout(r, 700))
  const book = await page.evaluate(() => {
    const num = (label) => {
      const row = [...document.querySelectorAll('.ledger__row')].find(
        (r) => r.querySelector('dt')?.textContent?.trim().toLowerCase().startsWith(label),
      )
      const raw = row?.querySelector('dd')?.textContent?.trim() ?? ''
      const sign = /^[−-]/.test(raw) ? -1 : 1
      return sign * Number(raw.replace(/[^0-9]/g, ''))
    }
    return {
      gross: num('gross revenue'),
      rent: num('rent'),
      profit: num('profit'),
      bonus: num('bonus from'),
      salary: num('your salary'),
      brand: (document.querySelector('.ledger__row--pm')?.textContent ?? '').toLowerCase(),
    }
  })
  const ok =
    book.gross - Math.abs(book.rent) === book.profit &&
    book.profit + book.bonus === book.salary &&
    book.brand.includes('paymoji')
  console.log(
    `  ${ok ? '✓' : '✗'} ${'the closing ledger adds up'.padEnd(42)} ` +
      `${book.gross} − ${Math.abs(book.rent)} = ${book.profit}, +${book.bonus} = ${book.salary}`,
  )
  if (!ok) failures++
  await page.close()
}

// 13. The best week survives a reload — it is the only thing that persists.
{
  const { page } = await open('/?day=1&c=1')
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForFunction(
    () => document.querySelector('.axie-stage')?.dataset.stage === 'ready',
    { timeout: 25_000 },
  )
  await playUntil(page, () => !!document.querySelector('.summary'), 200)
  await new Promise((r) => setTimeout(r, 1200))
  const first = await page.evaluate(() => ({
    badge: !!document.querySelector('.summary__badge'),
    total: Number(
      (document.querySelector('.summary__totalNum')?.textContent ?? '').replace(/\D/g, ''),
    ),
    stored: Number(JSON.parse(localStorage.getItem('com-tam-please:best:v1') ?? '{}').score ?? 0),
  }))

  // A fresh page in the same browser: same origin, so the same stored best.
  const { page: titlePage } = await open('/')
  const shown = await titlePage.evaluate(() => {
    const el = document.querySelector('.title__best')
    if (!el) return null
    return {
      text: el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      score: Number((el.querySelector('strong')?.textContent ?? '').replace(/\D/g, '')),
    }
  })

  const ok =
    first.badge &&
    first.total > 0 &&
    first.stored === first.total &&
    shown &&
    shown.score === first.total
  console.log(
    `  ${ok ? '✓' : '✗'} ${'best week persists to the title card'.padEnd(42)} ` +
      `${first.total} stored, title shows ${shown ? shown.score : 'nothing'}` +
      `${first.badge ? ', new-best badge shown' : ', NO badge'}`,
  )
  if (!ok) failures++
  await titlePage.close()
  await page.close()
}

// 14. A worse run afterwards must not overwrite it, and must say so.
{
  // One day out of five, so a much smaller score than the full week just banked.
  const { page } = await open('/?day=5&c=1')
  const before = await page.evaluate(
    () => Number(JSON.parse(localStorage.getItem('com-tam-please:best:v1') ?? '{}').score ?? 0),
  )
  await playUntil(page, () => !!document.querySelector('.summary'))
  await new Promise((r) => setTimeout(r, 1000))
  const after = await page.evaluate(() => ({
    stored: Number(JSON.parse(localStorage.getItem('com-tam-please:best:v1') ?? '{}').score ?? 0),
    badge: !!document.querySelector('.summary__badge'),
    line: document.querySelector('.summary__best')?.textContent?.trim() ?? '',
    total: Number(
      (document.querySelector('.summary__totalNum')?.textContent ?? '').replace(/\D/g, ''),
    ),
  }))
  const beat = after.total > before
  const ok = beat
    ? after.badge && after.stored === after.total
    : !after.badge && after.stored === before && /your best is still/i.test(after.line)
  console.log(
    `  ${ok ? '✓' : '✗'} ${'best week only moves when beaten'.padEnd(42)} ` +
      `${before} → ran ${after.total}, stored ${after.stored}${after.badge ? ' (new best)' : ''}`,
  )
  if (!ok) failures++
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\ninteractions all good')
process.exit(failures ? 1 : 0)
