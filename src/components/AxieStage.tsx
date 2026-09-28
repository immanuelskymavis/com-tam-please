import { useEffect, useRef, useState } from 'react'
import { Application, Container } from 'pixi.js'
import { loadSpineData } from '../lib/spineLoader.ts'
import { Spine } from 'pixi-spine'

/**
 * Renders one Axie via Spine. The skeletons ship as Spine 3.8.79, which pixi-spine
 * handles through its bundled 3.8 runtime — importing `pixi-spine` (rather than a
 * version-specific entry) is what registers the loader parser for the .atlas file.
 */

export type Reaction =
  | 'served'
  | 'refusedFairly'
  | 'refusedUnfairly'
  | 'scammedYou'
  | 'walkedOut'

/** How patient the customer still is. Drives which idle they loop. */
export type Mood = 'calm' | 'restless' | 'annoyed'

/** The animation names below all exist on every starter Axie (41 clips each). */
const ARRIVE = 'activity/entrance'
const IDLES = [
  'action/idle/normal',
  'action/idle/random-01',
  'action/idle/random-02',
  'action/idle/random-03',
  'action/idle/random-04',
  'action/idle/random-05',
]

/** Idles by mood: settled, fidgeting, then openly fed up. */
const MOOD_IDLES: Record<Mood, string[]> = {
  calm: ['action/idle/normal', 'action/idle/random-01'],
  restless: ['action/idle/random-02', 'action/idle/random-03', 'action/idle/random-04'],
  annoyed: ['action/idle/random-05', 'battle/get-debuff'],
}

const REACTIONS: Record<Reaction, string[]> = {
  // Served a good payment: celebrate, then eat.
  served: ['activity/victory-pose-back-flip', 'activity/eat-bite', 'activity/eat-chew'],
  // Correctly refused: they back off and leave.
  refusedFairly: ['action/move-back', 'action/run'],
  // Refused someone who actually paid. The wounded look.
  refusedUnfairly: ['battle/get-debuff', 'action/move-back'],
  // You got scammed. They bolt.
  scammedYou: ['action/run'],
  // Waited too long and gave up.
  walkedOut: ['battle/get-debuff', 'action/move-back', 'action/run'],
}

type Props = {
  /** Folder name under /public/axies. */
  axie: string
  /** When set, plays the reaction chain instead of idling. */
  reaction?: Reaction | null
  /** Bumping this replays the arrival animation. */
  arrivalKey?: string | number
  /** Drives which idle loop plays while they wait. */
  mood?: Mood
}

/**
 * 'loading' until the skeleton is on stage, 'ready' once it is, 'unavailable' if the
 * browser cannot give us WebGL at all. Surfaced as a data attribute so the state is
 * inspectable from outside — headless Chrome cannot composite the WebGL layer into a
 * screenshot, so the attribute is the only way to confirm the Axie really loaded.
 */
type StageState = 'loading' | 'ready' | 'no-webgl' | 'load-failed'

export function AxieStage({ axie, reaction, arrivalKey, mood = 'calm' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [stageState, setStageState] = useState<StageState>('loading')
  const moodRef = useRef<Mood>(mood)
  moodRef.current = mood
  const [stageError, setStageError] = useState<string | null>(null)
  const appRef = useRef<Application | null>(null)
  const spineRef = useRef<Spine | null>(null)
  const disposedRef = useRef(false)

  // Create the Pixi app once.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    disposedRef.current = false

    let app: Application
    try {
      app = new Application({
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio ?? 1, 2),
        autoDensity: true,
        width: host.clientWidth || 520,
        height: host.clientHeight || 560,
      })
    } catch (err) {
      // No WebGL (hardware acceleration off, ancient browser). Degrade to the stall
      // backdrop rather than taking the whole game down with us.
      console.error('[AxieStage] WebGL unavailable', err)
      setStageState('no-webgl')
      return
    }
    appRef.current = app
    host.appendChild(app.view as HTMLCanvasElement)

    const onResize = () => {
      if (!host || disposedRef.current) return
      app.renderer.resize(host.clientWidth || 520, host.clientHeight || 560)
      layout()
    }
    window.addEventListener('resize', onResize)

    // The stage also changes height when the citation slip appears and the grid
    // reflows — without this the Axie keeps its old scale and overflows the frame.
    const observer = new ResizeObserver(onResize)
    observer.observe(host)

    return () => {
      disposedRef.current = true
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      app.destroy(true, { children: true })
      appRef.current = null
      spineRef.current = null
    }
  }, [])

  /**
   * Fit the skeleton to the stage using its real bounds rather than its origin —
   * the Axie skeletons are not centred on their own origin, so centring the origin
   * leaves them visibly off to one side.
   */
  function layout() {
    const app = appRef.current
    const spine = spineRef.current
    if (!app || !spine) return
    const { width, height } = app.screen
    const b = skeletonBounds(spine)
    const scale = Math.min(width / b.width, height / b.height) * 0.92
    spine.scale.set(scale)

    // Centre the bounding box horizontally.
    spine.x = width / 2 - (b.x + b.width / 2) * scale

    // Spine is y-up, pixi is y-down, so the skeleton's lowest point (b.y) sits at
    // `spine.y - b.y * scale` on screen. Put that on the counter line.
    const floor = height * 1.02
    spine.y = floor + b.y * scale
  }

  // Load whichever Axie is at the counter.
  useEffect(() => {
    let cancelled = false
    const app = appRef.current
    if (!app) return

    ;(async () => {
      try {
        const data = await loadSpineData(axie)
        if (cancelled || disposedRef.current || !appRef.current) return

        // Swap out the previous Axie.
        if (spineRef.current) {
          spineRef.current.parent?.removeChild(spineRef.current)
          spineRef.current.destroy()
          spineRef.current = null
        }

        const spine = new Spine(data)
        const holder = new Container()
        holder.addChild(spine)
        app.stage.addChild(holder)
        spineRef.current = spine
        layout()

        spine.state.setAnimation(0, ARRIVE, false)
        spine.state.addAnimation(0, pickIdle(moodRef.current), true, 0)
        setStageState('ready')
      } catch (err) {
        console.error(`[AxieStage] failed to load ${axie}`, err)
        setStageState('load-failed')
        setStageError(String((err as Error)?.message ?? err).slice(0, 120))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [axie])

  // Replay the arrival when a new customer steps up.
  useEffect(() => {
    const spine = spineRef.current
    if (!spine || arrivalKey == null) return
    spine.state.setAnimation(0, ARRIVE, false)
    spine.state.addAnimation(0, pickIdle(moodRef.current), true, 0)
  }, [arrivalKey])

  // Escalate the idle when patience wears through, without interrupting a reaction.
  useEffect(() => {
    const spine = spineRef.current
    if (!spine || reaction) return
    spine.state.addAnimation(0, pickIdle(mood), true, 0)
  }, [mood, reaction])

  // Play the reaction chain when the player makes a call.
  useEffect(() => {
    const spine = spineRef.current
    if (!spine || !reaction) return
    const chain = REACTIONS[reaction]
    spine.state.setAnimation(0, chain[0], false)
    for (const name of chain.slice(1)) {
      // The final eat-chew loops, so a served customer keeps eating.
      spine.state.addAnimation(0, name, name.includes('eat-chew'), 0)
    }
    if (reaction === 'served') {
      // Keep chewing rather than snapping back to idle.
      return
    }
    spine.state.addAnimation(0, pickIdle(moodRef.current), true, 0)
  }, [reaction])

  return (
    <div ref={hostRef} className="axie-stage" data-stage={stageState} data-axie={axie}>
      {stageState === 'no-webgl' && (
        <p className="axie-stage__fallback">
          Turn on hardware acceleration to see the Axies
        </p>
      )}
      {stageState === 'load-failed' && (
        <p className="axie-stage__fallback" data-error={stageError ?? ''}>
          Couldn't load this Axie
        </p>
      )}
    </div>
  )
}

/**
 * Skeleton extents. Spine 3.8's runtime exposes getBoundsRect() but it is absent from
 * pixi-spine's typed interface, so read it defensively and fall back to the nominal
 * Axie skeleton size (968x758) declared in the .json.
 */
function skeletonBounds(spine: Spine): { x: number; y: number; width: number; height: number } {
  const skeleton = spine.skeleton as unknown as {
    getBoundsRect?: () => { x: number; y: number; width: number; height: number }
  }
  const r = skeleton.getBoundsRect?.()
  if (r && r.width > 1 && r.height > 1) return r
  // Nominal Axie skeleton box, from the .json header.
  return { x: -473, y: -95.5, width: 968, height: 758 }
}

const pickIdle = (mood: Mood) => {
  const pool = MOOD_IDLES[mood] ?? IDLES
  return pool[Math.floor(Math.random() * pool.length)]
}
