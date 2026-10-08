// @ts-check
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'
import { roadLandmarks } from './content/portfolio'
import { BikeController } from './game/BikeController'
import { createControls } from './game/createControls'
import { createCvLandmarks } from './game/createCvLandmarks'
import { createEngine } from './game/createEngine'
import { createRoad, createRoadSampler } from './game/createRoad'
import { createScene, disposeScene } from './game/createScene'
import { createProceduralBike } from './game/loadBike'
import { setupCamera } from './game/setupCamera'
import { setupInput } from './game/setupInput'
import { createLandmarkCard } from './ui/createLandmarkCard'
import './styles.css'

// Longest frame step applied to the bike, so a stalled tab cannot teleport it.
const MAX_FRAME_SECONDS = 0.1

const hero = document.querySelector('.hero')
const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('portfolio-canvas'))

if (!(hero instanceof HTMLElement) || !canvas) throw new Error('The portfolio hero is missing.')

/** @type {ReturnType<typeof createEngine>} */
let engineHandle
try {
  // The canvas fills the hero, so touch must still be able to scroll the page.
  engineHandle = createEngine(canvas, { engineOptions: { doNotHandleTouchAction: true } })
} catch (error) {
  // The whole portfolio is plain HTML below the hero; only the ride is lost.
  hero.classList.add('ride-unavailable')
  throw error
}

hero.classList.add('ride-ready')

const scene = createScene(engineHandle.engine)
scene.clearColor.set(0.043, 0.043, 0.043, 1)
scene.fogMode = Scene.FOGMODE_LINEAR
scene.fogColor = new Color3(0.043, 0.043, 0.043)
scene.fogStart = 34
scene.fogEnd = 70

new HemisphericLight('sky', new Vector3(0, 1, 0), scene).intensity = 1.2

// Wide enough that its edges sit in the fog rather than in view.
const ground = MeshBuilder.CreateGround('ground', { width: 120, height: 160 }, scene)
const groundMaterial = new StandardMaterial('ground-material', scene)
groundMaterial.diffuseColor = new Color3(0.14, 0.2, 0.17)
ground.material = groundMaterial

const roadLength = 80
const road = createRoad(scene, { length: roadLength, width: 8 })
const roadSampler = createRoadSampler(roadLength)
const landmarks = createCvLandmarks(scene, { roadSampler })
const bike = createProceduralBike(scene)
bike.root.position.z = -30
const alignBikeToRoad = () => {
  const sample = roadSampler(bike.root.position.z)
  bike.root.position.x = sample.center.x
  // Keep the procedural model's local -Z-to-forward correction while aligning
  // that forward direction with the sampled route tangent.
  bike.root.rotation.y = sample.yaw + Math.PI
}
alignBikeToRoad()

const controller = new BikeController(bike, { route: { minZ: -34, maxZ: 30 }, speed: 8 })
const camera = setupCamera(scene, bike.root)
const controls = createControls(hero, controller)
const card = createLandmarkCard(hero, { landmarks: roadLandmarks })

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

const render = () => {
  controller.update(Math.min(engineHandle.engine.getDeltaTime() / 1000, MAX_FRAME_SECONDS))
  alignBikeToRoad()
  card.update(bike.root.position.z)
  scene.render()
}

const setRendering = (/** @type {boolean} */ shouldRender) => {
  if (disposed || shouldRender === rendering) return
  rendering = shouldRender
  if (shouldRender) {
    engineHandle.engine.runRenderLoop(render)
  } else {
    // Nobody can see the ride, so park the bike and save the battery.
    controller.stop()
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
  hero.classList.remove('ride-ready')
  window.removeEventListener('pagehide', onPageHide)
  heroObserver.disconnect()
  diagnostics?.dispose()
  cancelOptimizationStartup()
  stopOptimization()
  card.dispose()
  controls.dispose()
  input.dispose()
  camera.dispose()
  landmarks.dispose()
  road.dispose()
  groundMaterial.dispose()
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
