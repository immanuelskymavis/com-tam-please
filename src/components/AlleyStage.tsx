import { useEffect, useRef, useState } from 'react'
import { Application, Container } from 'pixi.js'
import { loadSpineData } from '../lib/spineLoader.ts'
import { Spine } from 'pixi-spine'

/**
 * The street outside, in one shared Pixi canvas.
 *
 * Everyone moves left to right: the queue walks in from the left, the stall is in
 * the middle, and whoever has already been served is sitting on a stool to the
 * right eating. These are the real Spine skeletons at small scale, not stand-ins —
 * one Application with several instances sharing cached skeleton data, which is far
 * cheaper than a canvas each.
 */

type Slot = {
  axie: string
  x: number
  /**
   * Which way they look. Verified against all 8 starter skeletons: every one is
   * authored facing LEFT, so +1 is the natural pose and -1 mirrors them to look
   * right, up the street toward the stall.
   */
  facing: number
  anim: string
  scale: number
}

/** Authored facing is LEFT for every starter skeleton. Mirror it to look right. */
const FACE_LEFT = 1
const FACE_RIGHT = -1

type Props = {
  /** Still to come, nearest first. */
  waiting: string[]
  /** Fed and seated, most recent first. Only people who actually got a plate. */
  eating: { axie: string; dish: string }[]
  atWindow: string
  width: number
  height: number
  /** Reports where each eater landed, so their food can be drawn on the stool. */
  onSeats?: (seats: { x: number; dish: string }[]) => void
}

/** getBoundsRect exists on the 3.8 runtime but is absent from pixi-spine's types. */
function skeletonBounds(spine: Spine): { y: number; height: number } {
  const skeleton = spine.skeleton as unknown as {
    getBoundsRect?: () => { y: number; height: number }
  }
  const r = skeleton.getBoundsRect?.()
  return r && r.height > 1 ? r : { y: -95.5, height: 758 }
}

const WALK = 'action/move-forward'
const IDLE = 'action/idle/normal'
const CHEW = 'activity/eat-chew'

export function AlleyStage({ waiting, eating, atWindow, width, height, onSeats }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const layerRef = useRef<Container | null>(null)
  const disposed = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    disposed.current = false

    let app: Application
    try {
      app = new Application({
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio ?? 1, 2),
        autoDensity: true,
        width,
        height,
      })
    } catch {
      // No WebGL. The strip is scenery; the game is still playable without it.
      return
    }
    appRef.current = app
    host.appendChild(app.view as HTMLCanvasElement)

    const layer = new Container()
    app.stage.addChild(layer)
    layerRef.current = layer
    setReady(true)

    return () => {
      disposed.current = true
      app.destroy(true, { children: true })
      appRef.current = null
      layerRef.current = null
    }
  }, [])

  // Keep the canvas the size of the strip.
  useEffect(() => {
    appRef.current?.renderer.resize(width, height)
  }, [width, height])

  // Rebuild the cast whenever the queue changes.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !ready) return

    const shopX = width / 2
    const slots: Slot[] = []

    // The queue, walking in from the left toward the stall — so they face right.
    waiting.forEach((axie, i) => {
      slots.push({
        axie,
        x: shopX - 250 - i * 116,
        facing: FACE_RIGHT,
        anim: WALK,
        scale: 0.92,
      })
    })

    // Whoever is at the hatch, stood at the stall window, still facing it.
    slots.push({ axie: atWindow, x: shopX - 118, facing: FACE_RIGHT, anim: IDLE, scale: 1 })

    // Fed and seated to the right, turned back toward the stall they came out of.
    const seats: { x: number; dish: string }[] = []
    eating.forEach((entry, i) => {
      const x = shopX + 150 + i * 110
      slots.push({ axie: entry.axie, x, facing: FACE_LEFT, anim: CHEW, scale: 0.88 })
      seats.push({ x, dish: entry.dish })
    })
    onSeats?.(seats)

    let cancelled = false
    ;(async () => {
      layer.removeChildren().forEach((c) => c.destroy({ children: true }))
      for (const slot of slots) {
        if (cancelled || disposed.current) return
        if (slot.x < -60 || slot.x > width + 60) continue
        try {
          const data = await loadSpineData(slot.axie)
          if (cancelled || disposed.current || !layerRef.current) return
          const spine = new Spine(data)

          // Fit to the strip, then shrink so several read as a street rather than a portrait.
          const b = skeletonBounds(spine)
          const fit = (height * 0.58) / (b.height || 758)
          spine.scale.set(fit * slot.scale * slot.facing, fit * slot.scale)
          spine.x = slot.x
          spine.y = height * 0.92 + b.y * fit * slot.scale

          const hasClip = data?.animations?.some?.((a: { name: string }) => a.name === slot.anim)
          spine.state.setAnimation(0, hasClip ? slot.anim : IDLE, true)
          // Desynchronise them so the street doesn't march in lockstep.
          spine.state.tracks[0]!.trackTime = Math.random() * 2
          layerRef.current.addChild(spine)
        } catch {
          // A missing skeleton just means one fewer pedestrian.
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [waiting.join(','), eating.map((e) => e.axie).join(','), atWindow, ready, width, height])

  return <div ref={hostRef} className="alley__stage" data-alley={ready ? 'ready' : 'loading'} />
}
