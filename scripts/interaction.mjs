/**
 * Exercises the physical interactions: hand the plate across to serve, drop the
 * DENIED stamp on the phone to refuse, and let patience run out to trigger a walkout.
 *
 *   node scripts/interaction.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:5177'

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

const open = async (url) => {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + url, { waitUntil: 'networkidle2' })
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
  const { page } = await open('/?day=10&c=1')
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

  // c1 is genuine (cơm tấm) → serve. c2 is a screenshot → refuse. c3 is genuine (chè) → serve.
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 600)); await next(); await new Promise((r) => setTimeout(r, 800))
  await dragTo(page, '.tool--stamp', '.desk__phone')
  await new Promise((r) => setTimeout(r, 600)); await next(); await new Promise((r) => setTimeout(r, 800))
  await dragTo(page, '.tool--plate', '.booth__hatch')
  await new Promise((r) => setTimeout(r, 600)); await next(); await new Promise((r) => setTimeout(r, 1400))

  const street = await page.evaluate(() => ({
    stools: document.querySelectorAll('.stool').length,
    dishes: [...document.querySelectorAll('.stoolDish')].map((d) => d.getAttribute('src')),
  }))
  // Two served, one refused: two stools, and each plate is that customer's own order.
  // Compare filenames, not full paths — the deployed build serves assets under a
  // base prefix (/<repo>/) that the local dev server doesn't have.
  const names = street.dishes.map((d) => d.split('/').pop())
  const ok =
    street.stools === 2 &&
    names.length === 2 &&
    names.includes('che.jpg') &&
    names.includes('comtam.jpg')
  console.log(
    `  ${ok ? '✓' : '✗'} ${'refused customers never sit down'.padEnd(42)} ` +
      `${street.stools} seated, ${names.join(' + ')}`,
  )
  if (!ok) failures++
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} failing` : '\ninteractions all good')
process.exit(failures ? 1 : 0)
