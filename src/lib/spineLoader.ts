import { Assets, Texture } from 'pixi.js'
import { TextureAtlas } from 'pixi-spine'
import { AtlasAttachmentLoader, SkeletonJson } from '@pixi-spine/runtime-3.8'
import { ASSETS, type SpineAsset } from './assets.ts'

/**
 * One shared loader for every Spine skeleton in the app. All 8 starter Axies ship
 * as Spine 3.8.79, so this hardcodes the 3.8 runtime rather than auto-detecting.
 *
 * This deliberately bypasses pixi-spine's own Assets/Loader extension for the
 * atlas and skeleton files (fetching and parsing them by hand instead) because
 * that extension's `metadata.images` override — the documented way to hand it an
 * already-loaded texture instead of letting it resolve the image by URL, which
 * this app needs since the json/atlas/png are not co-located once each is an
 * independently hosted artifact asset — has a real race in this version:
 *
 *   let retval;
 *   const resolveCallback = (newAtlas) => resolve(retval);
 *   retval = new TextureAtlas(asset, (line, callback) => {
 *     // pixi-spine's own callback, not code this app writes:
 *     if (page.baseTexture) callback(page.baseTexture);   // <-- fires SYNCHRONOUSLY
 *   }, resolveCallback);
 *
 * When the texture is already resolved (exactly the case here, since the PNG is
 * preloaded before this runs), that inner callback fires synchronously, which
 * calls `resolveCallback` *while `retval = new TextureAtlas(...)` is still being
 * assigned* — so `resolveCallback` reads `retval` as `undefined` and resolves the
 * promise with that. A `|| asset` fallback further up then silently substitutes
 * the *raw atlas text string* for the parsed atlas object, and the eventual
 * `atlas.findRegion(...)` call inside AtlasAttachmentLoader throws
 * "this.atlas.findRegion is not a function" — because `this.atlas` is a string.
 *
 * Building the atlas here instead means this app's own callback runs, and it
 * defers with a microtask so `retval`'s assignment always completes first.
 */

const inFlight = new Map<string, Promise<any>>()

export function loadSpineData(axie: string): Promise<any> {
  const cached = inFlight.get(axie)
  if (cached) return cached

  const asset: SpineAsset | undefined = (ASSETS.axies as Record<string, SpineAsset>)[axie]
  if (!asset) return Promise.reject(new Error(`unknown axie slug: ${axie}`))

  const promise = (async () => {
    const [texture, atlasText, skeletonJson] = await Promise.all([
      Assets.load(asset.png) as Promise<Texture>,
      fetch(asset.atlas).then((r) => r.text()),
      fetch(asset.json).then((r) => r.json()),
    ])

    const atlas = await new Promise<InstanceType<typeof TextureAtlas>>((resolve, reject) => {
      const built = new TextureAtlas(
        atlasText,
        (line, callback) => {
          // Deferred on purpose — see the module comment. `built` must finish
          // being assigned before this fires.
          queueMicrotask(() => {
            if (line === asset.imageName) callback(texture.baseTexture)
          })
        },
        (newAtlas) => (newAtlas ? resolve(built) : reject(new Error(`texture failed for ${axie}`))),
      )
    })

    const json = new SkeletonJson(new AtlasAttachmentLoader(atlas))
    return json.readSkeletonData(skeletonJson)
  })()

  inFlight.set(axie, promise)
  // A failed load must not poison the cache — the next attempt should retry.
  promise.catch(() => inFlight.delete(axie))
  return promise
}
