# Cơm Tấm, Please

**▶ Play: https://immanuelskymavis.github.io/com-tam-please/**

You're an Axie running a cơm tấm stall in Saigon. Tourists pay by QR, and you never see the money
land — you see their phone, and you decide whether to believe it.

A Papers, Please-style inspection game built on PayMoji's real payment flow and first-party Axie assets.
Design rationale and the full rule ladder live in [docs/PRD.md](docs/PRD.md).

```bash
npm install
npm run dev
```

Then open http://localhost:5177.

**Demo jumps.** `?day=3` opens on a given day; `?day=3&c=2` goes straight to that day's 2nd customer,
skipping the cards. `?seed=1` pins the week, so a jump lands on the same customer every time — with
`seed=1`, day 3 customer 6 (the missing zero on a printed sticker) is the single best thing to show.

## How you play

It's a booth, not a form. A minimap strip runs along the top — bezelled, desaturated and scanlined,
so it reads as a feed of the street rather than more scenery. Everything in it moves left to right:
the queue walks in from the left facing the stall, through the stall itself in the middle, and out
to the red stools on the right, where each person sits eating **the dish they actually ordered**.
Anyone you refused never appears out there — they left with nothing. Those are the real Spine Axies
at a third scale, all sharing one canvas.

Below that, the customer stands behind the counter and your side of it is a working food stall.

- **To serve:** pick the plate up off the warming tray and drag it through the hatch.
- **To refuse:** pick up the DENIED stamp and drop it on their phone. Both tools are the same size
  and carry the same grab affordance — neither is the default.
- **The drop zones tell you where to let go.** Picking a tool up arms its target with a dashed
  outline; moving over it lights up solid and the label changes to "Let go".
- **Two clocks.** Each customer has patience (42s on day 1, 26s by day 5): they fidget, then sulk,
  then leave. And the whole shift is timed — when it runs out you close up wherever you are.
- **The street is the scoreboard.** Every plate you hand over walks out and sits down with it.
- **The rulebook** lies on the desk. Open it mid-customer; every rule you've been taught is in it,
  along with today's board rate.

## The week

Five days. Day 1 is written by hand and identical every run; **days 2-5 are dealt** from a pool of
honest customers and fraud variants against a per-run seed, so the same rules come back but never
in the same order, at the same prices, or with the same excuses. Rent is derived from what the
day's honest customers are worth, so a dealt day can't come out unwinnable.

| Day | New rules | Customers |
|---|---|---|
| 1 | amount matches the ticket | 4 |
| 2 | receipt still live · paid to your account | 5 |
| 3 | live not a screenshot · typed sticker amount · transaction id unused | 6 |
| 4 | board rate · bank name vs its BIN · settled in đồng | 6 |
| 5 | the final exam — all nine, plus one person you'd rather not apply them to | 7 |

A stage timeline on the morning card, the closing card and the counter board shows which day you're
on and how much week is left.

## Scoring

Money and score are different numbers on purpose. Đồng across the counter settles against rent;
the score is what the week is actually played for, and it rewards two things money alone doesn't:

- **Streaks.** Each consecutive correct call adds 15% to the multiplier, up to 2.5×.
- **Speed.** Calling while the customer is still calm pays up to 60% more than dithering until
  they're fed up.
- **Catching a fraud pays.** A correct refusal is worth half the ticket you just avoided losing —
  and a *wrong* refusal costs you half of one. Without that penalty, refusing everything is close to
  free: it survives the early days on two strikes apiece and banks every catch. The score is what
  punishes it, not the strike counter.

The run ends on a shareable star screen. **Three stars** are measured against the week you were
actually dealt — `perfectScore()` replays it as a flawless, instant run, and that's the denominator
for the stars, the percentage and the rank, so a lucky deal of expensive tickets can't buy a better
result. Three stars at 70% of that ceiling, two at 45%, one at 20%.

`src/game/sim.ts` plays 40 dealt weeks four ways and asserts the spread holds: flawless play lands
at 81% of the ceiling and always finishes, one mistake a day at 34% and still finishes, and neither
brute-force strategy gets past day 3 or above 3%. It also checks the curve in between — stars by
mistakes made in the week: **0–1 → ★★★, 2–3 → ★★, 4–5 → ★** — and that dithering through a flawless
week earns two stars rather than three, so speed keeps mattering.

## What's built

Days 1–10, 4 customers each (5 on the last), **41 hand-authored encounters** — about a minute a day.
Nine rules, one per day, none of them ever retiring:

| Day | Rule | The tell |
|-----|------|----------|
| 1 | Amount must match the ticket | Receipt total ≠ what they ordered |
| 2 | Receipt must still be live | Payment expired before it settled |
| 3 | Paid to *your* account | It went to the phở place two doors down |
| 4 | Live receipt, not a screenshot | A live receipt counts down; a screenshot is frozen |
| 5 | Sticker days: check the typed amount | A printed QR carries no amount, so they type it |
| 6 | Transaction ID must be new | One receipt shown twice, for two plates |
| 7 | Rate must match the board | The printed rate disagrees with the board, or the maths doesn't work |
| 8 | Bank name must match its code | It says Vietcombank next to 970422, which is MB Bank |
| 9 | Must settle in đồng | Marked sent, but settled in baht — it never reached you |
| 10 | *(no new rule)* | Everything at once, a tighter clock, and someone who deserves better |


Adding a day is pure content — append to `src/content/days.ts`, then run the audit.

## Look and feel

**Two design systems, deliberately.** The game chrome uses Axie's own `@axieinfinity/dango` tokens
(`--dg-*`). Everything on the phone uses PayMoji's, lifted from paymoji.app itself: lime `#8fca2b`
and `#c7e963` on near-black `#14151a`, lilac accent, Inter throughout. Keeping them distinct is the
point — the phone should read as a real app held up across a counter, not as part of the furniture.

**The booth.** Three bands, like Papers, Please: the alley seen from overhead with the queue still
waiting in it, the hatch with the Axie behind a counter drawn *over* them, and your desk below —
the customer's phone, your POS terminal, the QR scanner, the transaction log on a spike, the
rulebook, the warming tray, and the pots, chopsticks, chilli, fish sauce and herbs of a stall that
also has to cook.

**The food is real.** Each menu item carries its own photograph, and when you serve someone the Axie
is handed the dish it actually ordered — the plate lands on the counter and shrinks bite by bite,
timed against the `eat-bite` / `eat-chew` Spine clips.

**Papers, Please beats.** A stamp slams onto the receipt — the word records what you did, the colour
records whether you were right. Wrong calls print a pink citation slip with the rule you missed and
what it cost; right calls print a beige one. Days close on an itemised ledger: taken at the counter,
rent, what's left.

## Layout

```
src/
  lib/vietqr.ts        VietQR (NAPAS) payload builder + parser, CRC16-CCITT-FALSE
  game/types.ts        Rules, receipt and encounter shapes
  game/validate.ts     The pure validator — one function, no UI
  game/store.ts        useReducer state machine
  game/audit.ts        Content check: authored violations vs computed, plus rent balance
  content/days.ts      The five-day plan and the dealer that builds a week from a seed
  content/pools.ts     Honest customers and fraud variants the dealer draws from
  lib/rng.ts           Seeded PRNG, so a run is random between plays and fixed within one
  game/scoring.ts      Streaks, speed, the per-week ceiling, stars and ranks
  content/menu.ts      Dishes, prices and photos; ticket totals are computed from these
  components/          Queue + AlleyStage (the street overhead), Booth (hatch + counter),
                       Desk (everything you touch), AxieStage (Spine), Receipt, QrSticker
  hooks/useDrag.ts     Pointer drag for the plate and the stamp
  game/sim.ts          Headless playthrough that asserts the difficulty curve
scripts/bot.mjs        Reference player both harnesses share — reads the counter, applies all 9 rules
scripts/shots.mjs      Screenshot harness (drives real Chrome, waits for Spine)
scripts/interaction.mjs  Drives the real drags and asserts what they do
public/axies/          8 starter Axies, Spine 3.8.79 (skeleton.json + .atlas + .png)
public/food/           Dish photographs
public/bg/             Street-stall backdrops
```

**The one architectural rule:** an encounter is a pure data object, and `findViolation()` is the only
thing that decides whether a receipt is good. `encounter.violation` records the author's *intent*;
the validator computes the *truth*. `audit.ts` runs both and shouts if they disagree.

## Checks

```bash
npx tsc --noEmit
npm run audit        # content, across 200 dealt weeks
npm run sim          # difficulty and the star curve, across 40 dealt weeks
npm run shots        # visuals — plays a whole week through to the star screen
npm run interaction  # the drags
```

The **audit** deals 200 weeks and verifies every dealt violation matches the validator, that no
encounter violates a rule the player hasn't been taught, that every rule a morning promises
actually turns up that day, that no day is left without an honest customer, and that rent stays a
beatable share. It also checks that the perfect-week ceiling doesn't swing wildly between deals,
since that's the number people paste at each other.

The **sim** plays 40 dealt weeks four ways and asserts the curve holds on all of them: a perfect
player always finishes, a player who slips once a day always survives, and neither brute-force
strategy gets past day 3 or above 3% of the ceiling. It also pins the star thresholds to measured
play rather than to a guess.

The **interaction** suite drives the real pointer: drag the plate to the hatch and expect a sale,
drop the stamp on the phone and expect a refusal, drop the plate somewhere meaningless and expect
nothing at all, wait out a customer's patience to confirm they actually leave, and play a day to
the end to check the stars on the summary agree with the percentage beside them.

The **shots** harness drives the real Chrome on this machine, waits for each Spine skeleton to report
`ready`, plays a full day by dragging, and writes `shots/*.png`. Note that Chrome's
`--screenshot` flag cannot do this: virtual time cancels the skeleton fetch and the WebGL layer never
composites, which looks exactly like a broken game. `.axie-stage[data-stage]` exists so the load state
is inspectable from outside.

## The QR codes are real

`src/lib/vietqr.ts` emits genuine VietQR (NAPAS) payloads with a valid CRC16, so the sticker on the
counter scans with a real banking app. The account number is deliberately fake — **never put a real
one in a scannable code.**

The static/dynamic distinction is the mechanical basis for day 5, not a metaphor: a dynamic payload
carries tag `54` (the amount) and a static one does not, because a printed sticker can't know what
you ordered.

## Deploying

```bash
npm run deploy
```

Builds and force-pushes to the `gh-pages` branch, which GitHub Pages serves.

Two things that will silently produce a blank page if you change them:

- **The base path.** A project Pages site is served from `/<repo>/`, not the domain root, so the
  build needs `BASE_PATH=/<repo>/`. `scripts/deploy.sh` derives that from the **git remote**, not the
  local folder name — those differ in this checkout, and using the folder name ships a page whose
  every asset 404s.
- **Where assets live.** Files in `public/` are served verbatim under that base, so
  `src/lib/assets.ts` builds their URLs from `import.meta.env.BASE_URL`. The two street photographs
  live in `src/assets/` instead, so Vite rewrites and hashes them in the CSS automatically.

`docs/github-pages-workflow.yml` is a GitHub Actions workflow that does the same thing on every push
to `main`, and runs the typecheck, content audit and difficulty sim first. It isn't installed —
adding it needs a token with `workflow` scope. To enable it, copy it to `.github/workflows/deploy.yml`
(the GitHub web editor can create it directly) and switch Pages to "GitHub Actions" as its source.

## Assets and licence

Axie Spine bodies come from [`unity-axie-gtk2d`](https://github.com/axieinfinity/unity-axie-gtk2d).
UI is `@axieinfinity/dango`, so the game sits inside the Axie design system rather than beside it.

Food and street photography is Creative Commons / public domain from Wikimedia Commons — see
[ATTRIBUTION.md](ATTRIBUTION.md), which the CC BY and CC BY-SA files legally require.

⚠️ **The kit licence limits use to "Axie Vibeathon and other Sky Mavis-approved programs."** This is
fine for an internal build, but don't publish it to a public URL without a nod from whoever owns
the kit.

## Known gaps

- No sound. The Origins kit ships 152 SFX — the cheapest juice available if the loop earns it.
- Desktop only, 1280×800, mouse required. The drags are pointer-based so touch would work, but the
  layout is not built for it.
- PayMoji's display face (Neulis Neue) is commercial, so the wordmark is tight-tracked Inter.
- No persistence; refreshing restarts the day, and no best score is kept between runs.
- The dealer varies which fraud and which excuse turn up, but not the difficulty curve within a
  day — a day never front-loads its hardest call.
