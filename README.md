# Cơm Tấm, Please

You're an Axie running a cơm tấm stall in Saigon. Tourists pay by QR, and you never see the money
land — you see their phone, and you decide whether to believe it.

A Papers, Please-style inspection game built on PayMoji's real payment flow and first-party Axie assets.
Design rationale and the full rule ladder live in [docs/PRD.md](docs/PRD.md).

```bash
npm install
npm run dev
```

Then open http://localhost:5177.

**Demo jumps.** `?day=8` opens on a given day; `?day=8&c=2` goes straight to that day's 2nd customer,
skipping the cards. Day 5 customer 2 (the missing zero) is the single best thing to show.

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
- **Two clocks.** Each customer has patience (40s on day 1, 20s by day 10): they fidget, then sulk,
  then leave. And the whole shift is timed — when it runs out you close up wherever you are.
- **The street is the scoreboard.** Every plate you hand over walks out and sits down with it.
- **The rulebook** lies on the desk. Open it mid-customer; every rule you've been taught is in it,
  along with today's board rate.

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
  content/days.ts      All 30 encounters
  content/menu.ts      Dishes, prices and photos; ticket totals are computed from these
  components/          Queue + AlleyStage (the street overhead), Booth (hatch + counter),
                       Desk (everything you touch), AxieStage (Spine), Receipt, QrSticker
  hooks/useDrag.ts     Pointer drag for the plate and the stamp
  game/sim.ts          Headless playthrough that asserts the difficulty curve
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
npx esbuild src/game/audit.ts --bundle --format=esm | node --input-type=module   # content
npx esbuild src/game/sim.ts   --bundle --format=esm | node --input-type=module   # difficulty
node scripts/shots.mjs                                                            # visuals
node scripts/interaction.mjs                                                      # the drags
```

The **audit** verifies every authored violation matches the validator, that no encounter violates a
rule the player hasn't been taught yet, and that each day's rent sits at a beatable share of a
perfect run.

The **sim** plays the game three ways and asserts the curve: a perfect player finishes all 5 days, a
player who serves everyone ends day 1 at −95,000 ₫, and one who refuses everyone takes nothing and
collects strikes. Neither brute-force strategy works — you have to actually read the receipt.

The **interaction** suite drives the real pointer: drag the plate to the hatch and expect a sale,
drop the stamp on the phone and expect a refusal, drop the plate somewhere meaningless and expect
nothing at all, and wait out a customer's patience to confirm they actually leave.

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
- No persistence; refreshing restarts the day.
- Day 8's moral-dilemma finale isn't written.
