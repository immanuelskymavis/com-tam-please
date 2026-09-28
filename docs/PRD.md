# Cơm Tấm, Please — PRD v2

**One line:** You're an Axie running a cơm tấm stall in Saigon. Tourists pay by QR. Your job is to
tell a real payment from a fake one before the plate leaves the counter.

**Status:** ✅ **Built.** Days 1–5 playable — see [../README.md](../README.md) to run it.
v2 revised after auditing the real asset repos and paymoji.app
**Constraints:** ~3 days build · fully simulated (no chain, no backend) · official Axie assets
**Genre:** document-inspection sim (Papers, Please)

---

## 1. Why this game

Two things make this more than a logo pasted on a genre.

**The scam is real.** In Vietnam, the merchant displays the QR and the customer scans it. The merchant
never sees the payment happen — they see the customer's phone showing a "paid" screen, and decide
whether to trust it. Faked confirmation screenshots are a genuine, everyday problem. So the game isn't
a contrived inspection fiction: it's the actual judgement call a Saigon food vendor makes 80 times a day.

**PayMoji's own UI is the game screen.** An inspection game is a screen you scrutinise. No metaphor
needed. A player who finishes day 8 has internalised what a valid QR payment looks like and where it
can go wrong, purely as a side effect of trying to make rent.

**Non-goal:** this is not a PayMoji tutorial. If it stops being funny it has failed.

### ⚠️ Correction from v1: PayMoji is not a crypto app on the surface

v1 of this doc put `2.47 USDC` on the receipt. That's wrong. [paymoji.app](https://www.paymoji.app/)
never says crypto, blockchain, or token anywhere. What it actually says:

- **"More travel memories, fewer bank fees"** (headline)
- **"Pay easy, anywhere you go in Southeast Asia"**
- **"Scan, check, done"**
- **"You'll see the fees and rates before you pay — always"** · "No hidden markups, no monthly charges"
- Top up by **card or Apple Pay**. Self-custodial wallet — *"only you have the keys"*
- Live: **Vietnam (VietQR, VNPay)**, **Philippines (QR Ph)**. Coming: MY, SG, ID
- Handles **both dynamic and static printed QR codes**

The self-custodial wallet is the only crypto tell, and it's framed as security, not currency. So the
receipt shows **amount, fee, rate** in fiat — not tokens. This kills v1's "wrong token" rule and
replaces it with something better that came out of the real QR spec (§3).

---

## 2. Core loop

One customer at a time, at a counter:

1. **Customer arrives.** Axie walks up, one line of dialogue, an order.
2. **Ticket appears.** Your side of the counter shows the order and total in đồng.
3. **They show you their phone.** A PayMoji-styled receipt panel slides up.
4. **You inspect.** Cross-reference receipt against ticket and every rule unlocked so far.
5. **You call it.** `SERVE` or `REFUSE`. One click, no undo.
6. **Resolution.** Correct → money in, they eat. Wrong → consequence (§4).

Target ~15s per customer by day 3, ~8s by day 8 as time pressure lands.

---

## 3. The rule ladder

The whole design lives here. One new rule per day; rules never retire. Each must be **checkable in
under two seconds once you know it** and **invisible if you don't**.

| Day | New rule | The bad case looks like |
|-----|----------|-------------------------|
| 1 | Amount must equal the ticket total | Receipt says 45,000đ, plate is 65,000đ |
| 2 | Receipt must be live, not expired | Payment timestamp is 40 minutes old |
| 3 | Recipient must be *your* account | Bank BIN and account number belong to the phở place two doors down |
| 4 | Live receipt, not a screenshot | Live receipts have a ticking countdown; screenshots are frozen |
| 5 | **Static-QR days need the amount checked twice** | Your dynamic QR machine breaks, so you tape up a printed static sticker. Static QRs carry *no amount* — the customer types it. Underpayment by "typo" spikes. |
| 6 | Transaction ID must be unused | Same TX ID as a receipt from earlier today (your log is on-screen) |
| 7 | FX conversion must match the posted rate | Receipt shows $2.50 → 45,000đ on a day your board says 26,300đ/$ |
| 8 | *(no new rule)* | Everything at once, shorter clock, and one customer who genuinely deserves a break |

Rule 5 is the best one and it fell straight out of the real VietQR spec — a static payload genuinely
has no amount field (§6). It's the rule that teaches something true about the payment rail.

Day 8 exists to make the player choose between the rules and a person. It's one scripted customer.

---

## 4. Economy and failure

Deliberately thin. Enough pressure to matter, not enough to need balancing.

- Served plate: **+65,000đ**
- Daily rent, due at end of day: **300,000đ** (≈6 correct calls of 8 customers)
- **Served a bad payment:** −65,000đ. You ate the cost, the money never arrives.
- **Refused a good payment:** no revenue, one reputation tick.
- **Three reputation ticks:** −100,000đ fine. Only long-tail consequence; keep it simple.
- Miss rent → day-end game over, receipt-styled summary. Restart the day, not the run.

8 customers × 8 days = 64 hand-authored encounters. That's the real content budget and the most
likely thing to get cut — see §8.

---

## 5. Art: what we actually have

Audited both repos. Better than assumed — **we get animated Spine Axies in the browser, not static PNGs.**

### Starter Axies — `unity-axie-gtk2d`
`Assets/AxieInfinity/AxieStandardAssets/Spines/starter-axies/` — **20 Axies**, each shipping
`<name>.json` + `<name>.atlas.txt` + `<name>.png`. That's the Spine runtime triple, web-loadable as-is.
Skeletons are **Spine 3.8.79** (pins the runtime version — see §6).

Roster: buba-beast, olek-plant, puffy-aquatic, ena-plant, support-plant, dps-beast, pomodoro-bug,
venoki-reptile, machito-reptile, dps-aquatic, hybrid-plant, shilin-bug, momo-bird, dps-bird,
support-beast, support-dusk, xia-beast, bing-beast, noir-aquatic, rouge-aquatic.

**41 animations each**, and the customer emotional loop is already fully animated:

| Beat | Animation |
|------|-----------|
| Customer approaches | `activity/entrance` → `action/move-forward` |
| Waiting at counter | `action/idle/normal`, `action/idle/random-01…05` |
| You served them (correct) | `activity/victory-pose-back-flip` → `activity/eat-bite` → `activity/eat-chew` |
| You refused them (correct) | `action/move-back` → `action/run` |
| You refused a good payment | `battle/get-debuff` (the wounded look) |
| You got scammed | `action/run` (they bolt) |
| Day ends | `activity/sleep` |
| Day 1 tutorial | `activity/prepare` |

We did not have to draw or animate a single thing. `eat-bite` and `eat-chew` existing is absurd luck.

### Set dressing — `axie-origins-asset-kit`
- `Assets/OriginsKit/PvE/Backgrounds/class/bg_shop.png` — **a shop background.** Our counter.
- `.../Backgrounds/events/lunar/` — Tết backgrounds, for a seasonal day
- `.../Textures/StatusIcons/` — 131 icons, usable for rule badges
- `.../PvE/Intents/` — 17 icons, usable for receipt status glyphs
- `.../Audio/` — 152 SFX, and 15 music tracks
- Note: Axie **bodies are not** in this repo. Bodies come from gtk2d spines above (or `@axieinfinity/mixer`).

### ⚠️ Two blockers found
1. **The Figma is login-gated.** `Atia Game UI - Design System` returns a login wall to any tool.
   **Recommended fix: skip it.** `@axieinfinity/dango` (v0.4.54-beta.5, *"React UI component library
   for Axie Infinity products"*) and `@axieinfinity/dango-icons` are both on **public npm** and are the
   code implementation of that system. Using the library beats reading the spec. If you want the Figma
   specifically, export the tokens page and drop it in `docs/`.
2. **The asset licence is narrow.** `LICENSE.md` limits use to *"Axie Vibeathon and other Sky Mavis-approved
   programs"* and forbids redistributing bundled third-party Unity packages. Fine for an internal
   hackathon build. **But it means the demo should not be published to a public URL without a nod
   from whoever owns the kit.** Keep the Artifact private, or host internally.

---

## 6. Technical plan

| Concern | Decision |
|---------|----------|
| Stack | Vite + React 18 + TypeScript. No router, no state lib — one `useReducer`. |
| Rendering | `pixi.js@7.2.4` + `pixi-spine@4.0.3` + `@pixi-spine/runtime-3.8` — 3.8 runtime is **required** by the 3.8.79 skeletons. |
| UI | `@axieinfinity/dango` + `@axieinfinity/dango-icons`, in place of the gated Figma. |
| Backend | None. Zero network calls. |
| Crypto | None. Balances, fees and rates are numbers in JSON. |
| Content | `days.json` — every day, rule, customer and receipt is data, not code. |
| Persistence | `localStorage` for day and money, wrapped in try/catch. |
| Precedent | `origins/web-vfx/` is already Vite + PixiJS 7.2.4 + mixer. Copy its setup rather than inventing one. |

**The one architectural rule:** an encounter is a pure data object.

```ts
type Encounter = {
  axie: string              // 'buba-beast'
  dialogue: string
  ticket: { items: string[]; total: number }
  receipt: Receipt          // valid, or violating exactly one unlocked rule
  violation: RuleId | null  // ground truth for scoring
}
```

Validation is then one pure function over `(encounter, unlockedRules)` — testable without the UI,
and it lets non-engineers author days in JSON.

### Real VietQR payloads — done, working

You said you had no sample. We generated valid ones instead. VietQR is EMVCo TLV with a
CRC16-CCITT-FALSE checksum (poly `0x1021`, init `0xFFFF`) over the payload including the `6304` tag.
Verified round-trip in `src/lib/vietqr.ts`. Dynamic, 65,000đ:

```
00020101021238540010A00000072701240006970436011010172866540208QRIBFTTA
53037045405650005802VN5913CO BA COM TAM6011HO CHI MINH621308091 com tam63040534
```

Static (the same stall, no amount field — this is rule 5's mechanical basis):

```
000201010211385400 …same merchant… 53037045802VN5913CO BA COM TAM6011HO CHI MINH63049F68
```

Tag `01` is `12` for dynamic and `11` for static; tag `54` is the amount and is **absent** from the
static payload. Tag `38` nests the NAPAS GUID `A000000727`, the bank BIN (`970436` = Vietcombank) and
the account number.

**Use:** render your stall's QR sticker as actual set dressing on the counter, from a genuine payload.
It's scannable, so someone at the hackathon can point a real phone at it — the best credibility beat
in the demo. **Use an obviously fake account number, never a real one.**

---

## 7. Screen layout

Single screen. No navigation, no menus beyond a title card. Desktop-first at 1280×800; mobile out of scope.

```
┌──────────────────────────────────────────────────────┐
│  DAY 3          ₫ 195,000 / 300,000        ●●○       │  day · rent progress · reputation
├───────────────────────┬──────────────────────────────┤
│                       │                              │
│   Axie customer       │   PAYMOJI RECEIPT            │  the receipt panel is the game.
│   (Spine, animated)   │   ─────────────────          │  styled to the real product UI.
│                       │   To     Cô Ba Cơm Tấm       │
│   "Two com tam        │   Amount 65,000 ₫            │
│    please!"           │   Fee    1,200 ₫             │
│                       │   Rate   26,300 ₫/$          │
│                       │   TX     a91f…03bc           │
│                       │   Expires in 0:57            │
├───────────────────────┴──────────────────────────────┤
│  TICKET: 2 × cơm tấm — 130,000 ₫    [QR sticker]     │
│  RULES (tap to expand)   ·   TODAY'S LOG             │
├──────────────────────────────────────────────────────┤
│         [  REFUSE  ]            [  SERVE  ]          │
└──────────────────────────────────────────────────────┘
```

Rules panel and transaction log must be **on-screen and glanceable**, never in a modal. Papers, Please
works because checking is a physical act of looking back and forth; a modal kills that.

### Receipt copy — PayMoji tone of voice

The receipt is the one place showing real product copy, so it follows the house voice: sentence case,
no trailing periods on headlines or buttons, numerals always, contractions, "tap" never "click".
Vocabulary per the dictionary — **"Fees"** not service charges, **"Exchange rate"/"Rate"** not
conversion factor, **"Amount"** not sum, **"On its way"** not pending, **"Done"/"Sent"** not
transaction completed.

Strings for the slice:

| Context | Copy |
|---|---|
| Receipt header, settled | `Sent` |
| Receipt header, in flight | `On its way` |
| Receipt header, expired | `This payment didn't go through` |
| Rate line helper | `You'll see the fees and rates before you pay — always` |
| Player serves | `Done` |
| Player refuses | `Not now` |
| Day-end, rent made | `Great — rent's covered 💸` |
| Day-end, rent missed | `You're short on rent` / `You made <amount> of <rent>. Tap to try the day again` |
| Tutorial helper | `Check the amount matches the ticket. Takes 2 seconds` |

Note the tension worth respecting: the house voice is *reassuring*, and the game's job is to make you
*suspicious*. Keep the receipt panel perfectly on-brand and warm — the suspicion should come from the
player's own scrutiny, not from the UI hinting. A receipt that telegraphs its own fakeness isn't a puzzle.

---

## 8. Scope: in, out, cut order

**In for the slice**
- Days 1–3 playable with rules 1–3
- The receipt panel, styled properly — this is where the visual budget goes
- Spine Axies with the arrive / idle / eat / flee animation set
- Working economy, rent check, day-end summary
- Title card, game-over card
- A real scannable VietQR sticker on the counter

**Out**
- Animation beyond the mapped Spine clips
- Narrative beyond per-customer dialogue lines
- Mobile layout, settings, save slots, difficulty options

**Cut order if time runs short** — from the bottom up:
1. Days 6–8 (ship 5 days; the ladder still reads)
2. Transaction log rule (rule 6 needs the most UI)
3. Reputation system (make wrong calls purely financial)
4. Day-end summary (go straight to the next day)
5. Spine → static PNG frames (last resort; loses most of the charm)

The floor is **days 1–3, animated Axies, beautiful receipt panel**. That alone demos the idea.

Sound is 152 SFX away from free — it's the cheapest juice available. Add it on day 3 if the loop works.

---

## 9. Resolved / open

**Resolved**
1. ~~Which Axie assets~~ → 20 Spine Axies, 41 animations each, web-ready (§5)
2. ~~PayMoji tone of voice~~ → applied, strings drafted (§7)
3. ~~No VietQR sample~~ → generated and verified, both variants (§6)
4. ~~Is 65,000đ right~~ → confirmed

**Still open**
1. **Can the demo be shared on a public URL?** The kit licence says Vibeathon / Sky Mavis-approved only.
   Assuming internal-only until someone says otherwise.
2. **Figma tokens** — using `@axieinfinity/dango` instead. Only needed if you want exact parity.

---

## 10. Definition of done

A teammate opens the link, plays three days without being told the rules, and correctly refuses a bad
payment because they *noticed something was off*. That's the whole bar.

---

## 11. What actually shipped

Days **1–5**, 6 customers each, 30 authored encounters — one day beyond the planned floor, because
day 5 (the sticker rule) is the one worth demoing and it came in cheaper than expected.

**Changed during the build**
- **6 customers a day, not 8.** Tickets are mixed-price rather than flat 65,000đ, so 6 gives the same
  day length with less authoring. Rents retuned to ~70–75% of a perfect run.
- **Rent is a daily target, not a running balance.** Simpler to read, and it makes each day
  independently replayable.
- **`?day=N` jumps to a day.** Nobody demoing wants to play four days to reach the good rule.
- **pixi.js pinned to 7.4.3, not 7.2.4.** `pixi-spine` pulls `@pixi/*` 7.4.3; leaving pixi.js at
  7.2.4 loaded two copies of the same classes. Matching versions collapses it to one.

**Verified, not assumed**
- Spine 3.8.79 skeletons render in the browser through `pixi-spine`; all 8 Axies load, and the
  arrive / idle / eat / flee animation chain plays off the shipped clips.
- The frozen countdown really is frozen — identical after 6 seconds, and the live pulse indicator is
  absent. That is the whole day-4 tell.
- Generated VietQR payloads round-trip and reject tampering; the TS module matches a Python reference
  byte for byte.
- A perfect player clears all 5 days. Serving everyone ends day 1 at −25,000đ; refusing everyone draws
  the fine. Neither brute-force strategy beats the game.

**Three bugs the checks caught**
1. Four of five rents were mathematically unwinnable — a perfect run earned less than rent. The
   content audit caught it before anyone played.
2. The transaction log dropped the most recent entry, which would have made the day-6 duplicate rule
   unplayable.
3. On day 5, five unlocked rules pushed the Serve/Refuse buttons off-screen and clipped multi-item
   tickets. Panels are now height-capped with the rules list scrolling, and the ticket opts out —
   a clipped order would make the game unplayable.

**Still not built:** days 6–7 have validator support but no encounters; day 8's finale is unwritten;
no sound; desktop only.

---

## 12. Second pass — pacing, branding, theming

**Days are shorter.** 4 customers instead of 6 — roughly a minute a day, so the whole 5-day arc
demos quickly and the new rule still lands twice. Rents retuned; the audit enforces the margin.

**PayMoji branding is now the real thing.** Pulled from paymoji.app's own stylesheet rather than
guessed: lime `#8fca2b` / `#c7e963` on near-black `#14151a`, lilac `#d9b2ff` accent, Inter.
**The v2 receipt's blue wordmark was wrong** — PayMoji has no blue in its identity. The phone now
uses the PayMoji palette and the game chrome keeps Axie's dango tokens, which is the point: the
phone should read as a separate real app, not as game furniture. Their display face, Neulis Neue,
is commercial, so the wordmark is tight-tracked Inter.

**The stall looks like a stall.** Striped awning, string bulbs, painted sign, wooden counter the
Axie stands behind, over real Hanoi and Hội An street-vendor photographs. All Creative Commons or
public domain from Wikimedia Commons, credited in `ATTRIBUTION.md` — CC BY and CC BY-SA require it.

**The Axies eat what they ordered.** `content/menu.ts` gives every dish a photograph and a price;
ticket totals are computed from the menu, which removes a whole class of authoring bug. Serving
someone lands the dish on the counter and shrinks it bite by bite against the `eat-bite` /
`eat-chew` clips.

**More Papers, Please.** A stamp slams onto the receipt — word records the action, colour records
whether it was right. Wrong calls print a pink citation naming the rule you missed and its cost;
right calls print a beige one. Days close on an itemised ledger rather than a sentence.

### Bugs this pass surfaced
1. **The Axie was centred on its skeleton origin, not its bounds** — the Axie skeletons aren't
   centred on their own origin, so it sat visibly off to one side and overflowed the frame.
2. **No `ResizeObserver` on the stage.** When the citation slip appeared the grid reflowed, but the
   skeleton kept its old scale and spilled out of the frame.
3. **An unguarded `new Application()`** took the entire app down to a blank page when WebGL was
   unavailable. Now it degrades to the stall backdrop with an explanation — the exact failure you
   don't want on a stranger's laptop at a demo.

### A verification trap worth knowing
Chrome's headless `--screenshot` flag **cannot** verify this game. Virtual time cancels the Spine
skeleton fetch (it surfaces as `TypeError: Failed to fetch` on a URL that serves 200 to curl), and
the WebGL layer never composites, so a working game photographs as an empty stall. `scripts/shots.mjs`
drives real Chrome over CDP and waits on `.axie-stage[data-stage="ready"]` instead.


---

## 13. Third pass — the booth

The layout is now Papers, Please' three bands rather than a dashboard.

**Overhead alley.** The queue waits above you: one pip per customer still to come, the one at the
hatch ringed white, the stall roof and parked bikes seen from above. The pressure is ambient — you
feel the line without reading a number.

**The hatch.** The Axie stands *behind* a wooden counter drawn over them, under glass glare, in a
frame cut into the booth wall. A patience bar runs under the sill.

**The desk.** Your side: their phone pushed across, your POS terminal, the QR scanner, the
transaction log on a spike, the rulebook, the warming tray — and the pot, chopstick jar, chilli,
fish sauce, herbs, bowls and napkins of a stall that also has to cook. Panels hang from the top so
the desk surface shows beneath them; that strip is where the clutter lives.

**You hand the food over.** There is no Serve button any more. Pick the plate up off the tray and
drag it through the hatch; pick up the DENIED stamp and drop it on their phone. Dropping either
anywhere else does nothing, which is tested.

**Patience.** 40 seconds on day 1, down to 20 by day 10. They idle calmly, then fidget through the
`random-0X` clips, then openly sulk on `get-buff`/`get-debuff`, then walk. A walkout costs the sale
but carries no strike — they didn't do anything wrong, and neither did you.

### Five more days, four more things to track
Day 6 duplicate transaction id · day 7 board rate (both the printed rate *and* whether the
arithmetic works) · day 8 bank name against its NAPAS BIN · day 9 settlement currency · day 10 no
new rule, everything at once, a tighter clock, and a regular who is nine thousand đồng short and
telling the truth about all of it.

41 encounters. The audit still passes: every authored violation matches the validator, nothing
violates a rule the player hasn't been taught, and every rent sits at a beatable share.

### Bugs this pass surfaced
1. **Six desk children in a five-column grid.** The warming tray wrapped to an implicit row and the
   plate — the only way to serve anyone — was pushed off the bottom of the screen entirely.
2. **The booth wall was an absolutely-positioned overlay with no z-index**, so it painted over the
   speech bubble and patience bar beneath it. The dialogue was in the DOM, correctly styled, and
   invisible.
3. **The clutter props covered the receipt's countdown** — the one pixel-level tell the whole day-4
   rule depends on.
4. **The rulebook was clipped by the desk's `overflow: hidden`**, opening as a 6px sliver. It is now
   `position: fixed` so it lies across the counter; no ancestor has a transform, so fixed escapes.
5. **The screenshot harness still clicked Serve/Refuse buttons that no longer exist.** It reported
   every scene clean while silently doing nothing, because it only failed on console errors. It now
   drives the real drags.

The last one is the one worth remembering: a green test suite that no longer touches the thing it
claims to test is worse than no suite.


---

## 14. Fourth pass — the street, two clocks, two tools

**The street reads left to right.** The queue walks in from the left, the stall is dead centre, and
everyone already served sits on a red stool to the right, eating. These are the real Spine
skeletons at roughly a third scale, all in **one shared Pixi canvas** — several instances over
cached skeleton data, rather than a canvas each.

**Two clocks, not one.** Per-customer patience still drains (40s on day 1, 20s by day 10), and a
whole-shift countdown now sits on the wall board, turning red under 15 seconds. When it expires the
day closes wherever you are.

**Both tools weigh the same.** The plate and the DENIED stamp are now identical 104px discs with the
same dashed grab outline, the same grip dots, the same hover lift and idle float. Previously the
stamp was a small object tucked in a corner while the plate was large and obvious, which quietly
implied serving was the default action. It isn't.

### Bugs this pass surfaced
1. **The shift clock only started on customer 1**, so arriving mid-day via `?c=` left it dead at
   `--:--` forever. It now starts on any entry into `serving` that has no clock running.
2. **The overhead Axies were scaled to 82% of the strip** and spaced 92px apart, so they overlapped
   into one heap and buried the stall sign. Now 58% and spaced wider than they are tall.
3. **The screenshot and interaction suites still targeted `.plate` and `.stampTool`** after the
   tools were rebuilt as `.tool--plate` / `.tool--stamp`. This time the harness *failed loudly*
   ("could not drag") instead of passing while doing nothing — the fix from the last pass working
   exactly as intended.

The sim now also asserts the two new state transitions directly: the shift clock closing a day
mid-service, and a walkout costing the sale but never a strike.


---

## 15. Fifth pass — title screen, and the street as scoreboard

**Title screen.** A stall front at night: awning, string lights, the name stacked big with a Cô Ba
stamp beside it, a live Spine Axie already waiting at a wooden counter, and the PayMoji lockup
underneath. The background photo is blurred, desaturated and dimmed behind a horizontal gradient so
the type and the Axie carry the composition.

**The minimap reads as a minimap.** It now sits in its own bezel with a live label
(`ĐƯỜNG ĐINH LIỆT · LIVE`, blinking dot), scanlines, a vignette and a cool desaturated cast. The
booth below stays warm. Two different places, obviously.

**A stall you walk through.** The middle of the strip is a real structure — awning, sign, two posts
framing an opening, a counter across the front, warm light spilling out, and a flowing chevron on
the pavement showing the direction of travel.

**The street is the scoreboard.** Only customers who actually received food appear on the stools,
each eating their own order — the store now records `fed: { axie, dish }[]` as plates go out. Being
scammed still counts: you handed the plate over, so they sit and eat it. Refusals and walkouts leave
with nothing and never appear.

### Bugs this pass surfaced
1. **The Axies faced the wrong way.** I had the authored orientation backwards, so the mirror flag
   was inverted — the queue walked toward the stall while looking away from it.
2. **The stool dishes were invisible.** They had `z-index: 4` against a canvas at `z-index: 3`, but
   they were nested inside a `z-index: 1` parent — a child cannot escape its parent's stacking
   context however high its own z-index. Stools and plates are now separate layers, one behind the
   Axies and one in front.
3. **The Cô Ba stamp landed on top of the P** in "Please", which read as a rendering fault rather
   than a flourish.

The interaction suite now also asserts the street: serve, refuse, serve, then check two stools
appear carrying chè and cơm tấm respectively — the right count *and* the right food.


---

## 16. Sixth pass — facing (settled), drop targets, a real handset

**Facing, settled empirically.** I had flipped this twice on guesswork and got it wrong both times.
Rendering all eight starter skeletons unmirrored side by side shows every one is authored **facing
left**. So `FACE_LEFT = 1`, `FACE_RIGHT = -1`: the queue and the customer at the window mirror to
look right up the street, and the fed customers stay unmirrored to look back at the stall. Worth the
two minutes it took to check rather than a third coin-flip.

**Drop targets have two states.** Picking a tool up *arms* its zone (dashed outline, soft glow);
moving over it *lights* it (solid bright ring, outer glow, the counter top turning lime, the label
changing from "Hand it over" to "Let go"). The phone does the same in red, with a STAMP HERE tag.

**The phone looks like a phone.** Deeper chassis with a metallic edge, four side buttons, a proper
status bar — time, dynamic island, signal bars, wifi, battery — and a home indicator at the bottom.

### Bug worth recording
Both drop labels rendered perfectly and were invisible, because the 104px object you are dragging
follows the cursor at `z-index: 90` and sits exactly where a centred label goes. The DOM said
`visible`, `opacity: 1`, `z-index: 7`; the screenshot said nothing there. Fixed by moving the hatch
label to the top-left corner, away from where the cursor can be.

The `dragPlate` / `dragStamp` scenes now assert both halves of this: that the zone actually carries
its highlight class, and that `elementFromPoint` at the label's centre returns the label rather than
something on top of it. A drop hint that exists but cannot be seen is the same as no hint.


---

## 17. Seventh pass — the countdown had fallen off the desk

Adding the phone chassis (status bar, home indicator) and the bank row grew the receipt past the
desk, and the **countdown was the part that fell off the bottom**. That is the worst possible thing
to lose: it is the entire day-4 tell, so without it a whole rule becomes unplayable.

**The countdown moved up.** It now sits directly beneath the amount, sharing the dark block with it,
instead of being the last row. It is the thing the game turns on, so it should not be last in line
for space.

**The rows were rebalanced.** Minimap 178→156, desk 344→380, and every desk panel grew to match.
The booth absorbs the difference (264px tall at 800px viewport, 425px at 961px).

Checked against the tallest variant in the game — day 9, where a "Settled in THB" row appears. That
row is itself a rule tell, so clipping it would have broken day 9 the same way. Every receipt now
fits with the timer, the last row and the home indicator all inside the desk, at both 800px and
961px viewport heights.

The live pulse dot also gained contrast: it was lime on a dark forest block and nearly invisible, so
the live/frozen difference was hard to read at a glance.

### The guard
Every counter scene in the screenshot harness now asserts that the countdown sits inside the desk,
is on screen, and that the last receipt row is inside too. This class of bug — content growing until
a tell silently drops off the bottom — has now happened twice, and both times the DOM looked
perfectly healthy while the thing was simply not where anyone could see it.


---

## 18. Shipped to GitHub Pages

**Live: https://immanuelskymavis.github.io/com-tam-please/** — repo
`immanuelskymavis/com-tam-please`, deployed from the `gh-pages` branch via `npm run deploy`.

### Why the Artifact build broke
The published artifact rendered everything *except* the Axies. The split was diagnostic: food photos
and street backgrounds appeared (they load as `<img>` and CSS `url()`), while every Spine skeleton
was missing — and Spine is the only thing that loads over `fetch()`. The artifact sandbox's CSP
permits images and stylesheets but blocks `fetch`/XHR, so the skeleton, atlas and texture requests
never completed. GitHub Pages is an ordinary origin with no such restriction, which is why the same
build works there untouched.

### What deploying required
- **Base path.** A project Pages site is served from `/<repo>/`. `public/` asset URLs are now built
  from `import.meta.env.BASE_URL`, and the two street photographs moved into `src/assets/` so Vite
  rewrites and hashes them in the CSS.
- **Actions workflow not installed.** The available token lacks `workflow` scope, so
  `.github/workflows/` could not be pushed. The workflow is kept at
  `docs/github-pages-workflow.yml` for one-click enablement; deployment meanwhile runs from the
  `gh-pages` branch, which needs no special scope.

### Two bugs caught before they shipped
1. **`deploy.sh` derived the base from the local folder name** (`axie-paymoji`) rather than the repo
   name (`com-tam-please`). The build succeeded and would have produced a page where every asset
   404s. Now taken from the git remote.
2. **The street-seating test hardcoded `/food/che.jpg`.** Correct behaviour, wrong assertion: under
   a base prefix the path is `/com-tam-please/food/che.jpg`. It now compares filenames, so the same
   suite passes against both the dev server and the deployed site.

The full interaction suite passes against the live URL, not just locally:
`BASE=https://immanuelskymavis.github.io/com-tam-please node scripts/interaction.mjs`.
