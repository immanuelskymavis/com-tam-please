/**
 * Repeatable visual check. Drives the real Chrome on this machine, waits for the
 * Spine stage to actually report ready, and writes screenshots to shots/.
 *
 *   node scripts/shots.mjs            # every scene
 *   node scripts/shots.mjs counter    # just one
 *
 * Headless Chrome's --screenshot flag cannot do this: virtual time cancels the
 * skeleton fetch, and the WebGL layer never composites.
 */
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:5177'
const OUT = 'shots'

const SCENES = {
  title: { url: '/', wait: 'title' },
  morning: { url: '/?day=5', wait: 'title', click: 'Open the stall' },
  counter: { url: '/?day=1&c=1', wait: 'stage' },
  sticker: { url: '/?day=5&c=2', wait: 'stage' },
  screenshotRule: { url: '/?day=4&c=2', wait: 'stage' },
  duplicate: { url: '/?day=6&c=2', wait: 'stage' },
  rate: { url: '/?day=7&c=2', wait: 'stage' },
  bankCode: { url: '/?day=8&c=2', wait: 'stage', rulebook: true },
  currency: { url: '/?day=9&c=2', wait: 'stage' },
  finale: { url: '/?day=10&c=5', wait: 'stage' },
  served: { url: '/?day=1&c=1', wait: 'stage', drag: ['.tool--plate', '.booth__hatch'], settle: 900 },
  citation: { url: '/?day=1&c=2', wait: 'stage', drag: ['.tool--plate', '.booth__hatch'], settle: 900 },
  refused: { url: '/?day=5&c=2', wait: 'stage', drag: ['.tool--stamp', '.desk__phone'], settle: 700 },
  ledger: { url: '/?day=1&c=1', wait: 'stage', playDay: true },
  // Mid-drag: the drop zones have to light up while the tool is still in hand.
  dragPlate: { url: '/?day=1&c=1', wait: 'stage', hold: ['.tool--plate', '.booth__hatch'] },
  dragStamp: { url: '/?day=1&c=1', wait: 'stage', hold: ['.tool--stamp', '.desk__phone'] },
}

/** Drag with intermediate moves — a single jump skips the pointermove handler. */
async function dragTo(page, fromSel, toSel) {
  const at = async (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }
    }, sel)
  const from = await at(fromSel)
  const to = await at(toSel)
  if (!from || !to) return false
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await new Promise((r) => setTimeout(r, 20))
  }
  await page.mouse.up()
  return true
}

const only = process.argv[2]
const scenes = only ? { [only]: SCENES[only] } : SCENES
if (only && !SCENES[only]) {
  console.error(`unknown scene "${only}". known: ${Object.keys(SCENES).join(', ')}`)
  process.exit(1)
}

await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--window-size=1280,800', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 800 },
})

let failures = 0
for (const [name, scene] of Object.entries(scenes)) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(BASE + scene.url, { waitUntil: 'networkidle2', timeout: 30_000 })

  if (scene.wait === 'stage') {
    // Wait for the Spine skeleton to actually be on stage, not merely for the DOM.
    await page.waitForFunction(
      () => document.querySelector('.axie-stage')?.dataset.stage === 'ready',
      { timeout: 25_000 },
    ).catch(() => {
      const state = 'timed out'
      console.log(`  ! ${name}: stage never became ready (${state})`)
      failures++
    })
  } else if (scene.wait === 'title') {
    await page.waitForFunction(
      () => document.querySelector('.title .axie-stage')?.dataset.stage === 'ready',
      { timeout: 25_000 },
    ).catch(() => { console.log(`  ! ${name}: title Axie never loaded`); failures++ })
  } else {
    // Never let one scene's wait take the whole run down with it.
    await page.waitForSelector('.card', { timeout: 15_000 }).catch(() => {
      console.log(`  ! ${name}: no .card appeared`)
      failures++
    })
  }

  if (scene.rulebook) {
    await page.evaluate(() => {
      const tab = document.querySelector('.rulebook__tab')
      if (tab instanceof HTMLElement) tab.click()
    })
    await new Promise((r) => setTimeout(r, 250))
  }

  if (scene.hold) {
    // Same as a drag, but we never release — this captures the highlighted state.
    const at = async (sel) =>
      page.evaluate((x) => {
        const el = document.querySelector(x)
        if (!el) return null
        const b = el.getBoundingClientRect()
        return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }
      }, sel)
    const from = await at(scene.hold[0])
    const to = await at(scene.hold[1])
    if (!from || !to) { console.log(`  ! ${name}: missing ${scene.hold[0]} or ${scene.hold[1]}`); failures++ }
    else {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
        await new Promise((r) => setTimeout(r, 22))
      }
      await new Promise((r) => setTimeout(r, 320))
      // The highlight must actually be on, and its label must not be buried.
      const lit = await page.evaluate((isPlate) => {
        const zone = isPlate
          ? document.querySelector('.booth')
          : document.querySelector('.desk__phone')
        const label = isPlate
          ? document.querySelector('.booth__drop')
          : document.querySelector('.dropTag')
        if (!zone || !label) return { ok: false, why: 'no zone or label' }
        const r = label.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return {
          ok: zone.className.includes('is-target') || zone.className.includes('is-over'),
          visible: top === label || label.contains(top),
        }
      }, scene.hold[0].includes('plate'))
      if (!lit.ok) { console.log(`  ! ${name}: drop zone never highlighted`); failures++ }
      if (!lit.visible) { console.log(`  ! ${name}: drop label is covered`); failures++ }
    }
  }

  if (scene.drag) {
    const ok = await dragTo(page, scene.drag[0], scene.drag[1])
    if (!ok) { console.log(`  ! ${name}: could not drag ${scene.drag[0]} → ${scene.drag[1]}`); failures++ }
    await new Promise((r) => setTimeout(r, scene.settle ?? 800))
  }

  if (scene.playDay) {
    // Serve the genuine ones, stamp the rest, until the ledger appears.
    for (let step = 0; step < 20; step++) {
      const state = await page.evaluate(() => {
        if (document.querySelector('.ledger')) return 'done'
        const next = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim().toLowerCase() === 'next customer',
        )
        if (next) { next.click(); return 'advanced' }
        // Serve only when the receipt agrees with the POS total, is still counting
        // down, and went to our account.
        const amount = document.querySelector('.receipt__amount')?.textContent?.replace(/\s/g, '') ?? ''
        const due = document.querySelector('.pos__total span:last-child')?.textContent?.replace(/\s/g, '') ?? ''
        const live = !!document.querySelector('.receipt__pulse')
        const acct = [...document.querySelectorAll('.receipt__row')].find((r) =>
          r.textContent?.startsWith('Account'),
        )?.textContent ?? ''
        return amount === due && live && acct.includes('1017286654') ? 'serve' : 'refuse'
      })
      if (state === 'done') break
      if (state === 'serve') await dragTo(page, '.tool--plate', '.booth__hatch')
      else if (state === 'refuse') await dragTo(page, '.tool--stamp', '.desk__phone')
      await new Promise((r) => setTimeout(r, 360))
    }
    await new Promise((r) => setTimeout(r, 450))
  }

  if (scene.click) {
    const clicked = await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.trim().toLowerCase().includes(label.toLowerCase()),
      )
      if (!btn) return false
      btn.click()
      return true
    }, scene.click)
    if (!clicked) { console.log(`  ! ${name}: no button matching "${scene.click}"`); failures++ }
    await new Promise((r) => setTimeout(r, scene.settle ?? 1200))
    if (scene.wait === 'stage') {
      await page.waitForFunction(
        () => document.querySelector('.axie-stage')?.dataset.stage === 'ready',
        { timeout: 15_000 },
      ).catch(() => {})
    }
  }

  // The countdown is the day-4 tell. If it ever falls outside the desk it is
  // invisible, and that day becomes unplayable — so check it on every counter scene.
  if (scene.wait === 'stage') {
    const timer = await page.evaluate(() => {
      const t = document.querySelector('.receipt__timer')
      const desk = document.querySelector('.desk')
      if (!t || !desk) return null
      const tb = t.getBoundingClientRect()
      const db = desk.getBoundingClientRect()
      return {
        inside: tb.bottom <= db.bottom && tb.top >= db.top,
        onScreen: tb.bottom <= window.innerHeight,
        lastRowInside:
          [...document.querySelectorAll('.receipt__row')].pop()?.getBoundingClientRect().bottom <=
          db.bottom,
      }
    })
    if (timer && !(timer.inside && timer.onScreen && timer.lastRowInside)) {
      console.log(
        `  ! ${name}: receipt clipped (timer inside=${timer.inside} onScreen=${timer.onScreen} lastRow=${timer.lastRowInside})`,
      )
      failures++
    }
  }

  const stage = await page.evaluate(() => {
    const el = document.querySelector('.axie-stage')
    return el ? { state: el.dataset.stage, axie: el.dataset.axie } : null
  })

  await page.screenshot({ path: `${OUT}/${name}.png` })
  const tag = stage ? `stage=${stage.state} ${stage.axie}` : 'no stage'
  console.log(`  ${name.padEnd(16)} ${tag}${errors.length ? `  ERRORS: ${errors[0]}` : ''}`)
  if (errors.length) failures++
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} problem(s)` : '\nall scenes clean')
process.exit(failures ? 1 : 0)
