// @ts-check
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { roadLandmarks } from './content/portfolio'
import { BikeController } from './game/BikeController'
import { createAtmosphere } from './game/createAtmosphere'
import { createControls } from './game/createControls'
import { createCvLandmarks } from './game/createCvLandmarks'
import { createEngine } from './game/createEngine'
import { createRoad, createRoadSampler } from './game/createRoad'
import { createScene, disposeScene } from './game/createScene'
import { createTerrain } from './game/createTerrain'
import { createVegetation } from './game/createVegetation'
import { createWindEffects } from './game/createWindEffects'
import { createRideEnding } from './game/createRideEnding'
import { loadBike } from './game/loadBike'
import { setupCamera } from './game/setupCamera'
import { setupInput } from './game/setupInput'
import { createLandmarkCard } from './ui/createLandmarkCard'
import './styles.css'
import bikeModelUrl from './assets/models/moto.glb?url'

// Longest frame step applied to the bike, so a stalled tab cannot teleport it.
const MAX_FRAME_SECONDS = 0.1

const hero = document.querySelector('.hero')
const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('portfolio-canvas'))

if (!(hero instanceof HTMLElement) || !canvas) throw new Error('The portfolio hero is missing.')

/** @type {ReturnType<typeof createEngine>} */
let engineHandle
try {
  // The canvas fills the hero, so touch must still be able to scroll the page.
  // Phones report device pixel ratios of 3 or more; rendering the ride at full
  // density would cost far more than it shows.
  engineHandle = createEngine(canvas, { engineOptions: { doNotHandleTouchAction: true, limitDeviceRatio: 1.5 } })
} catch (error) {
  // The whole portfolio is plain HTML below the hero; only the ride is lost.
  hero.classList.add('ride-unavailable')
  throw error
}

const scene = createScene(engineHandle.engine)
// Fetch the bike while the scenery is built.
const bikeLoading = loadBike(scene, bikeModelUrl)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Nothing in the ride responds to hovering, so skip picking on every pointer move.
scene.skipPointerMovePicking = true
const atmosphere = createAtmosphere(scene)

// The road runs well past both ends of the ride so it fades into the haze
// instead of stopping in view.
const roadLength = 1040
// Riders steer between the ends of the ride. Past the finish the bike rides
// on by itself, over the crest that ends the road (see createRoad) and out of
// sight, to a stop well behind it.
const ride = { minZ: -340, finishZ: 340, goneZ: 465, maxZ: 480 }
const route = { minZ: ride.minZ, maxZ: ride.maxZ }
const startZ = ride.minZ + 5
// Matches the canvas opacity transition in styles.css.
const FADE_SECONDS = 0.6
const topSpeed = 24
const road = createRoad(scene, { length: roadLength, width: 8 })
const roadSampler = createRoadSampler(roadLength)
const terrain = createTerrain(scene, { roadSampler })
const landmarks = createCvLandmarks(scene, { roadSampler })
/** @type {Awaited<typeof bikeLoading>} */
let bike
try {
  bike = await bikeLoading
} catch (error) {
  engineHandle.dispose()
  hero.classList.add('ride-unavailable')
  throw error
}
// The ride hints only make sense once the bike is there to ride.
hero.classList.add('ride-ready')
bike.root.position.z = startZ

const controller = new BikeController(bike, { route, speed: topSpeed, acceleration: 9, deceleration: 14 })
const ending = createRideEnding({ finishZ: ride.finishZ, goneZ: ride.goneZ, lingerSeconds: 2, fadeSeconds: FADE_SECONDS })
// How fast the view itself rushes along: nothing once the camera stops to watch
// the bike leave, so the wind and speed effects die down with it.
const viewerSpeed = () => (ending.phase === 'riding' ? controller.getSpeedRatio() : 0)
const camera = setupCamera(scene, bike.root, {
  roadSampler,
  getSpeedRatio: viewerSpeed,
  reducedMotion,
})
// Streaks rushing at the viewer are exactly what reduced motion asks to avoid.
const wind = reducedMotion
  ? null
  : createWindEffects(scene, {
      camera: camera.camera,
      bike,
      getSpeedRatio: viewerSpeed,
      topSpeed,
    })

// Only the bike casts a shadow: a tight shadow map that follows it around.
const shadows = new ShadowGenerator(1024, atmosphere.sun)
// The sun sits 30 units up-light of the bike (see alignBikeToRoad); a tight
// depth range keeps the shadow map precise instead of spanning the whole sky.
atmosphere.sun.shadowMinZ = 1
atmosphere.sun.shadowMaxZ = 60
shadows.usePercentageCloserFiltering = engineHandle.engine.webGLVersion >= 2
shadows.usePoissonSampling = engineHandle.engine.webGLVersion < 2
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW
shadows.bias = 0.002
shadows.normalBias = 0.02
for (const mesh of bike.meshes) shadows.addShadowCaster(mesh)
for (const surface of road.surfaces) surface.receiveShadows = true

let lean = 0
const alignBikeToRoad = (/** @type {number} */ seconds) => {
  const sample = roadSampler(bike.root.position.z)
  bike.root.position.x = sample.center.x
  bike.root.position.y = sample.center.y
  bike.root.rotation.y = sample.yaw
  // Positive Babylon X rotation tips the nose down; climbing needs it up.
  bike.root.rotation.x = -sample.pitch
  // Lean into bends like a real bike: tan(lean) = v² · curvature / g.
  const velocity = controller.getVelocity()
  const targetLean = Math.atan((velocity * velocity * sample.curvature) / 9.8) * 1.6
  lean += (targetLean - lean) * (1 - Math.exp(-seconds * 5))
  // Positive Z rotation tips the top towards -X (left); right bends lean right.
  bike.body.rotation.z = -Math.max(-0.6, Math.min(0.6, lean))
  atmosphere.sun.position.copyFrom(bike.root.position).subtractInPlace(atmosphere.sun.direction.scale(30))
}
alignBikeToRoad(0)

// Scenery is the slowest part to build; let the road and bike show first and
// plant it while the GPU is still compiling their shaders.
/** @type {ReturnType<typeof createVegetation> | null} */
let vegetation = null
const vegetationTimer = window.setTimeout(() => {
  vegetation = createVegetation(scene, {
    roadSampler,
    heightAt: terrain.heightAt,
    minZ: route.minZ - 120,
    maxZ: route.maxZ + 50,
    clearings: roadLandmarks.map(({ roadPosition }) => {
      const sample = roadSampler(roadPosition.z)
      const centre = sample.center.add(sample.lateral.scale(roadPosition.x))
      return { x: centre.x, z: centre.z, radius: 7 }
    }),
  })
}, 0)

const controls = createControls(hero, controller)
// Boards are spaced far apart, so the card shows for a good stretch either side.
const card = createLandmarkCard(hero, { landmarks: roadLandmarks, radius: 22 })

// Ride keys only drive while the hero is mostly on screen; elsewhere the
// arrows and Space scroll the page as usual.
let heroMostlyVisible = true
const input = setupInput(controller, { isEnabled: () => heroMostlyVisible })

let disposed = false
let rendering = false
/** @type {{ dispose: () => void } | null} */
let diagnostics = null
let stopOptimization = () => {}
let cancelOptimizationStartup = () => {}

const restartRide = () => {
  controller.setInputDirection('ride-off', 0)
  controller.park()
  bike.root.position.z = startZ
  lean = 0
  camera.follow({ snap: true })
  hero.classList.remove('ride-fading')
}

let shownSpeed = -1
const render = () => {
  const seconds = Math.min(engineHandle.engine.getDeltaTime() / 1000, MAX_FRAME_SECONDS)
  // Once it has left, the bike rides on whatever is pressed. Asserted every
  // frame because stopping or hiding the ride clears every input.
  if (ending.phase !== 'riding') controller.setInputDirection('ride-off', 1)
  controller.update(seconds)
  switch (ending.update(bike.root.position.z, seconds)) {
    case 'leave':
      camera.lock()
      controller.setInputDirection('ride-off', 1)
      break
    case 'fade':
      hero.classList.add('ride-fading')
      // The ride is over, so carry on down to the portfolio (smoothly unless
      // reduced motion is asked for; see styles.css). Hiding the hero pauses
      // the fade, which finishes and restarts the ride when it is scrolled back.
      document.getElementById('main')?.scrollIntoView()
      break
    case 'restart':
      restartRide()
      break
  }
  alignBikeToRoad(seconds)
  card.update(bike.root.position.z)
  // Drives the CSS speed vignette; skip style writes for invisible changes.
  const speed = Math.round(viewerSpeed() * 50) / 50
  if (speed !== shownSpeed) {
    shownSpeed = speed
    hero.style.setProperty('--ride-speed', String(speed))
  }
  scene.render()
}

const setRendering = (/** @type {boolean} */ shouldRender) => {
  if (disposed || shouldRender === rendering) return
  rendering = shouldRender
  if (shouldRender) {
    engineHandle.engine.runRenderLoop(render)
  } else {
    // Nobody can see the ride, so park the bike and save the battery.
    controller.park()
    engineHandle.engine.stopRenderLoop(render)
  }
}

const heroObserver = new IntersectionObserver(
  (entries) => {
    // Several threshold crossings can arrive at once; the newest one wins.
    const entry = entries[entries.length - 1]
    heroMostlyVisible = entry.intersectionRatio >= 0.5
    setRendering(entry.isIntersecting)
  },
  { threshold: [0, 0.5] },
)
heroObserver.observe(hero)
setRendering(true)

const dispose = () => {
  if (disposed) return
  setRendering(false)
  disposed = true
  // A back/forward-cache restore must not advertise a ride that is gone.
  hero.classList.remove('ride-ready', 'ride-fading')
  hero.style.removeProperty('--ride-speed')
  window.removeEventListener('pagehide', onPageHide)
  heroObserver.disconnect()
  diagnostics?.dispose()
  cancelOptimizationStartup()
  stopOptimization()
  card.dispose()
  controls.dispose()
  input.dispose()
  wind?.dispose()
  shadows.dispose()
  camera.dispose()
  bike.root.dispose()
  window.clearTimeout(vegetationTimer)
  vegetation?.dispose()
  landmarks.dispose()
  terrain.dispose()
  road.dispose()
  atmosphere.dispose()
  disposeScene(scene)
  engineHandle.dispose()
}

const onPageHide = () => dispose()
window.addEventListener('pagehide', onPageHide, { once: true })

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('inspect')) {
  void import('./game/setupDiagnostics').then(async ({ setupDiagnostics }) => {
    if (disposed) return
    const handle = await setupDiagnostics(scene)
    if (disposed) handle.dispose()
    else diagnostics = handle
  })
}

// Optimization is useful on constrained devices, but is not required for the
// first frame. Defer its module and startup until the browser is idle.
const startOptimization = () => {
  void import('./game/setupOptimization').then(({ setupOptimization }) => {
    if (disposed) return
    const cleanup = setupOptimization(scene)
    if (disposed) cleanup()
    else stopOptimization = cleanup
  })
}
const idleWindow = /** @type {{ requestIdleCallback?: Window['requestIdleCallback'], cancelIdleCallback?: Window['cancelIdleCallback'] }} */ (window)
if (idleWindow.requestIdleCallback) {
  const idleId = idleWindow.requestIdleCallback(startOptimization, { timeout: 1500 })
  cancelOptimizationStartup = () => idleWindow.cancelIdleCallback?.(idleId)
} else {
  const timeoutId = window.setTimeout(startOptimization, 0)
  cancelOptimizationStartup = () => window.clearTimeout(timeoutId)
}
