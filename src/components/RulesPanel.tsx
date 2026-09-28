import type { Rule } from '../game/types.ts'

/**
 * Always on-screen, never in a modal. Papers, Please works because checking is a
 * physical act of looking back and forth; a modal would kill that.
 */
export function RulesPanel({ rules, newestId }: { rules: Rule[]; newestId?: string }) {
  return (
    <div className="panel rules">
      <h3 className="panel__title">Rules</h3>
      <ol className="rules__list">
        {rules.map((r) => (
          <li key={r.id} className={r.id === newestId ? 'rules__item is-new' : 'rules__item'}>
            <span className="rules__label">{r.label}</span>
            <span className="rules__hint">{r.hint}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LogPanel({ txIds }: { txIds: string[] }) {
  return (
    <div className="panel log">
      <h3 className="panel__title">Today's log</h3>
      {txIds.length === 0 ? (
        <p className="log__empty">Nothing yet</p>
      ) : (
        <ul className="log__list">
          {txIds.map((id, i) => (
            <li key={`${id}-${i}`} className="mono">
              {id}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
