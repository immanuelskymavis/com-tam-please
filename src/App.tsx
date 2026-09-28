import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Button, Intent, Size } from '@axieinfinity/dango'
import type { State } from './game/store.ts'
import { initialState, isLastDay, madeRent, reducer } from './game/store.ts'
import { patienceForDay, RULES, rulesForDay, shiftForDay } from './game/types.ts'
import { findDay } from './content/days.ts'
import { heroDish, lineLabel } from './content/menu.ts'
import type { Mood } from './components/Booth.tsx'
import { Booth } from './components/Booth.tsx'
import { TitleScreen } from './components/TitleScreen.tsx'
import { Queue } from './components/Queue.tsx'
import { Desk } from './components/Desk.tsx'
import { useDrag } from './hooks/useDrag.ts'
import { dong } from './lib/format.ts'

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [rulebookOpen, setRulebookOpen] = useState(false)
  const [patience, setPatience] = useState(1)
  const [shiftLeft, setShiftLeft] = useState<number | null>(null)

  const day = findDay(state.day)
  const encounter = day?.encounters[state.index]
  const rules = useMemo(() => rulesForDay(state.day), [state.day])
  const newestRule = RULES.find((r) => r.day === state.day)?.id
  const serving = state.phase === 'serving'

  // ---- drag: plate to the hatch serves, stamp to the phone refuses ----
  const handleDrop = useCallback(
    (id: string, zone: string) => {
      if (!serving) return
      if (id === 'plate' && zone === '[data-hatch]') dispatch({ type: 'call', served: true })
      if (id === 'stamp' && zone === '[data-phone]') dispatch({ type: 'call', served: false })
    },
    [serving],
  )
  const { drag, hoverZone, start } = useDrag({
    onDrop: handleDrop,
    zones: ['[data-hatch]', '[data-phone]'],
  })

  // ---- the shift clock runs for the whole day, not just one customer ----
  const onTheCounter = state.phase === 'serving' || state.phase === 'feedback'
  useEffect(() => {
    if (state.phase !== 'serving') return
    // Start the clock on entering a day, and whenever we arrive mid-day (a ?c= jump)
    // with no clock running — otherwise the shift would never tick at all.
    setShiftLeft((current) =>
      current === null || state.index === 0
        ? shiftForDay(state.day, day?.encounters.length ?? 4)
        : current,
    )
  }, [state.day, state.phase, state.index === 0])

  useEffect(() => {
    if (!onTheCounter || shiftLeft === null) return
    if (shiftLeft <= 0) {
      dispatch({ type: 'endDay' })
      return
    }
    const id = setTimeout(() => setShiftLeft((t) => (t === null ? t : t - 1)), 1000)
    return () => clearTimeout(id)
  }, [onTheCounter, shiftLeft])

  // ---- patience drains while they stand there ----
  useEffect(() => {
    if (!serving || !encounter) return
    setPatience(1)
    const total = patienceForDay(state.day) * 1000
    const startedAt = performance.now()
    const id = setInterval(() => {
      const left = 1 - (performance.now() - startedAt) / total
      if (left <= 0) {
        clearInterval(id)
        setPatience(0)
        dispatch({ type: 'walkout' })
      } else {
        setPatience(left)
      }
    }, 120)
    return () => clearInterval(id)
  }, [serving, encounter?.id, state.day])

  if (!day) return <div className="card">No such day</div>

  if (state.phase === 'title') {
    return <TitleScreen onStart={() => dispatch({ type: 'start' })} />
  }

  if (state.phase === 'morning') {
    return (
      <Card
        kicker={`Day ${day.day}`}
        title={day.stickerDay ? 'The machine is dead' : 'Morning'}
        body={
          <>
            <p>{day.intro}</p>
            <p className="muted">
              Rent tonight: <strong>{dong(day.rent)}</strong> · Board rate today:{' '}
              <strong className="mono">{day.postedRate.toLocaleString('en-US')} ₫/$</strong>
            </p>
            {newestRule && (
              <p className="new-rule">
                New rule — {RULES.find((r) => r.id === newestRule)?.label}
              </p>
            )}
          </>
        }
        action={
          <Button
            text="Start the day"
            intent={Intent.Primary}
            size={Size.Large}
            onClick={() => dispatch({ type: 'beginDay' })}
          />
        }
      />
    )
  }

  if (state.phase === 'dayEnd') return <DayEnd state={state} dispatch={dispatch} />

  if (state.phase === 'finished') {
    return (
      <Card
        kicker="Ten days later"
        title="The stall survives"
        body={
          <p>
            You can spot a frozen countdown, a stranger's account number, a bank code that
            lies about its own name and a missing zero on a printed sticker. Grandma would
            be unbearable about this.
          </p>
        }
        action={
          <Button
            text="Play again"
            intent={Intent.Primary}
            size={Size.Large}
            onClick={() => dispatch({ type: 'restart' })}
          />
        }
      />
    )
  }

  if (!encounter) return <div className="card">No customer</div>

  const outcome = state.lastOutcome
  const showingFeedback = state.phase === 'feedback'
  const dish = heroDish(encounter.ticket.lines)
  const mood: Mood = patience > 0.6 ? 'calm' : patience > 0.3 ? 'restless' : 'annoyed'
  const waiting = day.encounters.slice(state.index + 1).map((e) => e.axie)
  // Only people who actually got a plate. Most recently fed sits nearest the stall.
  const eaten = [...state.fed].reverse()
  const shiftLow = shiftLeft !== null && shiftLeft <= 15

  return (
    <div className={`pp ${drag ? 'is-dragging' : ''}`}>
      <Queue waiting={waiting} eating={eaten} atWindow={encounter.axie} />

      <div className="pp__mid">
        <Booth
          axie={encounter.axie}
          arrivalKey={encounter.id}
          reaction={showingFeedback ? outcome?.reaction ?? null : null}
          mood={showingFeedback ? 'calm' : mood}
          patience={showingFeedback ? 1 : patience}
          dialogue={encounter.dialogue}
          dish={dish}
          handedOver={outcome?.reaction === 'served' || outcome?.reaction === 'scammedYou'}
          isArmed={drag?.id === 'plate'}
          isDropTarget={drag?.id === 'plate' && hoverZone === '[data-hatch]'}
        />

        <aside className="pp__board">
          <div className="board__row">
            <span className="board__k">DAY</span>
            <span className="board__v">{String(day.day).padStart(2, '0')}</span>
          </div>
          <div className="board__row">
            <span className="board__k">TAKEN</span>
            <span className={`board__v ${state.earned >= day.rent ? 'is-clear' : ''}`}>
              {state.earned.toLocaleString('en-US')}
            </span>
          </div>
          <div className="board__row">
            <span className="board__k">RENT</span>
            <span className="board__v">{day.rent.toLocaleString('en-US')}</span>
          </div>
          <div className="board__bar">
            <i style={{ width: `${Math.min(100, (state.earned / day.rent) * 100)}%` }} />
          </div>
          <div className="board__row board__row--rate">
            <span className="board__k">RATE</span>
            <span className="board__v">{day.postedRate.toLocaleString('en-US')} ₫/$</span>
          </div>
          <div className={`board__shift ${shiftLow ? 'is-low' : ''}`}>
            <span className="board__k">SHIFT ENDS IN</span>
            <span className="board__clock">{formatClock(shiftLeft)}</span>
          </div>
          <div className="board__strikes">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < state.reputation ? 'dot is-on' : 'dot'} />
            ))}
          </div>
        </aside>
      </div>

      <Desk
        receipt={encounter.receipt}
        frozenKey={encounter.id}
        lines={encounter.ticket.lines}
        total={encounter.ticket.total}
        isStaticQr={Boolean(day.stickerDay)}
        rules={rules}
        newestRuleId={newestRule}
        log={state.usedTxIds}
        dish={dish}
        plateHeld={drag?.id === 'plate'}
        stampHeld={drag?.id === 'stamp'}
        stampArmed={drag?.id === 'stamp'}
        stampOver={drag?.id === 'stamp' && hoverZone === '[data-phone]'}
        onGrab={start}
        rulebookOpen={rulebookOpen}
        onToggleRulebook={() => setRulebookOpen((o) => !o)}
        boardRate={day.postedRate}
      />

      {/* whatever is currently in your hand, following the cursor */}
      {drag && (
        <div
          className={`held held--${drag.id}`}
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy }}
        >
          {drag.id === 'plate' ? (
            <img src={dish.image} alt="" draggable={false} />
          ) : (
            <span className="held__stamp">DENIED</span>
          )}
        </div>
      )}

      {showingFeedback && outcome && (
        <Verdict outcome={outcome} onNext={() => dispatch({ type: 'next' })} />
      )}
    </div>
  )
}

/** The citation slip, slid across the counter after every call. */
/** mm:ss, or a dash before the shift has started. */
function formatClock(seconds: number | null) {
  if (seconds === null) return '--:--'
  const s = Math.max(0, seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Verdict({
  outcome,
  onNext,
}: {
  outcome: NonNullable<State['lastOutcome']>
  onNext: () => void
}) {
  const rule = outcome.violation ? RULES.find((r) => r.id === outcome.violation) : null
  const walked = outcome.reaction === 'walkedOut'
  const wrong = !outcome.correct && !walked

  const head = walked ? 'Gave up' : wrong ? 'Citation' : outcome.reaction === 'served' ? 'Paid in full' : 'Good catch'

  return (
    <div className="verdictWrap">
      <div className={`citation ${wrong ? 'is-citation' : ''} ${walked ? 'is-walkout' : ''}`}>
        <div className="citation__head">{head}</div>
        <div className="citation__body">
          {walked ? (
            <>
              <strong>They waited too long and left</strong>
              <span>No sale. Nobody's fault but the queue</span>
            </>
          ) : wrong ? (
            outcome.reaction === 'scammedYou' ? (
              <>
                <strong>{rule?.label ?? 'Bad payment accepted'}</strong>
                <span>
                  Food handed over, money never arrived. −{dong(outcome.encounter.ticket.total)}
                </span>
              </>
            ) : (
              <>
                <strong>Honest customer turned away</strong>
                <span>That payment was fine. They walked off hungry</span>
              </>
            )
          ) : (
            <>
              <strong>
                {rule ? rule.label : outcome.encounter.ticket.lines.map(lineLabel).join(', ')}
              </strong>
              <span>
                {outcome.reaction === 'served'
                  ? `+${dong(outcome.encounter.ticket.total)}`
                  : 'Nothing lost'}
              </span>
            </>
          )}
        </div>
        <Button text="Next customer" intent={Intent.Primary} onClick={onNext} />
      </div>
    </div>
  )
}

function DayEnd({
  state,
  dispatch,
}: {
  state: State
  dispatch: React.Dispatch<{ type: 'advanceDay' } | { type: 'retryDay' }>
}) {
  const day = findDay(state.day)!
  const cleared = madeRent(state)
  const balance = state.earned - day.rent

  return (
    <div className="card">
      <div className="card__inner ledger">
        <span className="card__kicker">Day {day.day} · closing up</span>
        <h1 className="card__title">{cleared ? "Rent's covered 💸" : "You're short on rent"}</h1>
        <dl className="ledger__rows">
          <div className="ledger__row">
            <dt>Taken at the counter</dt>
            <dd className="mono">{dong(state.earned)}</dd>
          </div>
          <div className="ledger__row">
            <dt>Rent</dt>
            <dd className="mono">−{dong(day.rent)}</dd>
          </div>
          <div className={`ledger__row ledger__row--total ${cleared ? 'is-good' : 'is-bad'}`}>
            <dt>{cleared ? 'Left over' : 'Short by'}</dt>
            <dd className="mono">{dong(Math.abs(balance))}</dd>
          </div>
        </dl>
        {!cleared && <p className="muted">Tap below to run the day again</p>}
        <div className="card__action">
          {cleared ? (
            <Button
              text={isLastDay(state.day) ? 'Finish' : 'Lock up for the night'}
              intent={Intent.Primary}
              size={Size.Large}
              onClick={() => dispatch({ type: 'advanceDay' })}
            />
          ) : (
            <Button
              text="Try the day again"
              intent={Intent.Primary}
              size={Size.Large}
              onClick={() => dispatch({ type: 'retryDay' })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Card({
  kicker,
  title,
  body,
  action,
}: {
  kicker: string
  title: string
  body: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="card__inner">
        <span className="card__kicker">{kicker}</span>
        <h1 className="card__title">{title}</h1>
        <div className="card__body">{body}</div>
        <div className="card__action">{action}</div>
      </div>
    </div>
  )
}
