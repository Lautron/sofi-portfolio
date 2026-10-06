// @ts-check
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { blogOrigin } from './config'
import { BikeController } from './game/BikeController'
import { createControls } from './game/createControls'
import { createCvLandmarks } from './game/createCvLandmarks'
import { createEngine } from './game/createEngine'
import { createRoad } from './game/createRoad'
import { createScene, disposeScene } from './game/createScene'
import { createProceduralBike } from './game/loadBike'
import { setupCamera } from './game/setupCamera'
import { setupInput } from './game/setupInput'
import './styles.css'

const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('portfolio-canvas'))

if (!canvas) throw new Error('The portfolio canvas is missing.')

const engineHandle = createEngine(canvas)
const scene = createScene(engineHandle.engine)
scene.clearColor.set(0.05, 0.075, 0.09, 1)

new HemisphericLight('sky', new Vector3(0, 1, 0), scene).intensity = 1.2

const ground = MeshBuilder.CreateGround('ground', { width: 28, height: 80 }, scene)
const groundMaterial = new StandardMaterial('ground-material', scene)
groundMaterial.diffuseColor = new Color3(0.14, 0.2, 0.17)
ground.material = groundMaterial

const road = createRoad(scene, { length: 80, width: 8 })
const landmarks = createCvLandmarks(scene)
const bike = createProceduralBike(scene)
bike.root.position.z = -30

const controller = new BikeController(bike, { route: { minZ: -34, maxZ: 34 }, speed: 8 })
const camera = setupCamera(scene, bike.root)
const input = setupInput(scene, controller)
const controls = createControls(scene, controller)

let blogLink = null
if (blogOrigin) {
  blogLink = document.createElement('a')
  blogLink.className = 'blog-link'
  blogLink.href = blogOrigin
  blogLink.rel = 'noopener noreferrer'
  blogLink.target = '_blank'
  blogLink.textContent = 'Blog'
  document.body.append(blogLink)
}

let disposed = false
/** @type {{ dispose: () => void } | null} */
let diagnostics = null
let stopOptimization = () => {}
let cancelOptimizationStartup = () => {}

const render = () => {
  controller.update(engineHandle.engine.getDeltaTime() / 1000)
  scene.render()
}

const dispose = () => {
  if (disposed) return
  disposed = true
  window.removeEventListener('pagehide', onPageHide)
  engineHandle.engine.stopRenderLoop(render)
  diagnostics?.dispose()
  cancelOptimizationStartup()
  stopOptimization()
  blogLink?.remove()
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
engineHandle.engine.runRenderLoop(render)

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
