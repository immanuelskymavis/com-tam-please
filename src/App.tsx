import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button, Intent, Size } from '@axieinfinity/dango'
import type { State } from './game/store.ts'
import {
  initialState,
  isLastDay,
  madeRent,
  reducer,
  runStats,
  TOTAL_DAYS,
} from './game/store.ts'
import { STRIKE_LIMIT } from './game/scoring.ts'
import { Takings } from './components/Takings.tsx'
import { RunSummary } from './components/RunSummary.tsx'
import { DayTrack } from './components/DayTrack.tsx'
import { newRulesForDay, patienceForDay, RULES, rulesForDay, shiftForDay } from './game/types.ts'
import { findDay, rollRun } from './content/days.ts'
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
  const patienceRef = useRef(1)
  patienceRef.current = patience
  const [shiftLeft, setShiftLeft] = useState<number | null>(null)

  const day = findDay(state.day)
  const encounter = day?.encounters[state.index]
  const rules = useMemo(() => rulesForDay(state.day), [state.day])
  // Days 2-4 unlock two or three rules at once, so this is a list, not one id.
  const newRules = useMemo(() => newRulesForDay(state.day), [state.day])
  const newRuleIds = useMemo(() => newRules.map((r) => r.id), [newRules])
  const serving = state.phase === 'serving'

  // ---- drag: plate to the hatch serves, stamp to the phone refuses ----
  const handleDrop = useCallback(
    (id: string, zone: string) => {
      if (!serving) return
      // patienceRef, not `patience` — this callback is memoised and would otherwise
      // close over a stale value, quietly paying the wrong speed bonus.
      const left = patienceRef.current
      if (id === 'plate' && zone === '[data-hatch]')
        dispatch({ type: 'call', served: true, patienceLeft: left })
      if (id === 'stamp' && zone === '[data-phone]')
        dispatch({ type: 'call', served: false, patienceLeft: left })
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
        track={<DayTrack day={state.day} cleared={state.daysCleared} />}
        body={
          <>
            <p>{day.intro}</p>
            <p className="muted">
              Rent tonight: <strong>{dong(day.rent)}</strong> · Board rate today:{' '}
              <strong className="mono">{day.postedRate.toLocaleString('en-US')} ₫/$</strong>
            </p>
            {newRules.length > 0 && (
              <>
                {newRules.length > 1 && (
                  <p className="new-rules__head">
                    {newRules.length} new rules today
                  </p>
                )}
                <ul className="new-rules">
                  {newRules.map((r) => (
                    <li key={r.id} className="new-rule">
                      {newRules.length === 1 ? `New rule — ${r.label}` : r.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {newRules.length === 0 && (
              <p className="new-rule">No new rules. Everything you already know, all at once</p>
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
      <RunSummary
        stats={runStats(state)}
        totalDays={TOTAL_DAYS}
        onReplay={() => {
          // A new run is a new week — deal fresh days before the reducer resets.
          rollRun()
          dispatch({ type: 'restart' })
        }}
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
          <Takings score={state.score} streak={state.streak} />
          <DayTrack day={state.day} cleared={state.daysCleared} compact />
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
          <div className="board__strikes" title={`${STRIKE_LIMIT} mistakes and the day is over`}>
            {Array.from({ length: STRIKE_LIMIT }).map((_, i) => (
              <span key={i} className={i < state.strikes ? 'dot is-on' : 'dot'} />
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
        newRuleIds={newRuleIds}
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
  // Strikes end a day, not rent. Missing rent is a bad night, not a game over.
  const survived = !state.failedOut
  const rentCleared = madeRent(state)
  const balance = state.earned - day.rent
  const dayScore = state.score - state.dayStart.score

  return (
    <div className="card">
      <div className="card__inner ledger">
        <DayTrack
          day={state.day}
          cleared={survived ? state.day : state.daysCleared}
          failedDay={survived ? undefined : state.day}
        />
        <span className="card__kicker">Day {day.day} · closing up</span>
        <h1 className="card__title">
          {!survived
            ? 'Three strikes — grandma took the keys'
            : rentCleared
              ? "Rent's covered 💸"
              : 'Short on rent, but the stall stands'}
        </h1>

        <dl className="ledger__rows">
          <div className="ledger__row">
            <dt>Taken at the counter</dt>
            <dd className="mono">{dong(state.earned)}</dd>
          </div>
          <div className="ledger__row">
            <dt>Rent</dt>
            <dd className="mono">−{dong(day.rent)}</dd>
          </div>
          <div className={`ledger__row ${rentCleared ? '' : 'is-bad'}`}>
            <dt>{rentCleared ? 'Left over' : 'Short by'}</dt>
            <dd className="mono">{dong(Math.abs(balance))}</dd>
          </div>
          <div className="ledger__row">
            <dt>Mistakes</dt>
            <dd className={`mono ${state.strikes > 0 ? 'is-bad' : ''}`}>
              {state.strikes} / {STRIKE_LIMIT}
            </dd>
          </div>
          <div
            className={`ledger__row ledger__row--total ${survived ? 'is-good' : 'is-bad'}`}
          >
            <dt>{survived ? "Added to today's takings" : 'Forfeited on the retry'}</dt>
            <dd className="mono">{dong(dayScore)}</dd>
          </div>
        </dl>

        <p className="muted">
          {survived
            ? `Run total ${dong(state.score)}`
            : 'Replaying the day rewinds what it earned — nothing is counted twice'}
        </p>

        <div className="card__action">
          {survived ? (
            <Button
              text={isLastDay(state.day) ? 'Finish the week' : 'Lock up for the night'}
              intent={Intent.Primary}
              size={Size.Large}
              onClick={() => dispatch({ type: 'advanceDay' })}
            />
          ) : (
            <Button
              text="Open up again"
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
  track,
}: {
  kicker: string
  title: string
  body: React.ReactNode
  action: React.ReactNode
  track?: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="card__inner">
        {track}
        <span className="card__kicker">{kicker}</span>
        <h1 className="card__title">{title}</h1>
        <div className="card__body">{body}</div>
        <div className="card__action">{action}</div>
      </div>
    </div>
  )
}
