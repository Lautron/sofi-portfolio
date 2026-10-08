import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { fractalNoise, smoothstep } from './random'

export interface AtmosphereHandle {
  sun: DirectionalLight
  dispose: () => void
}

// Golden hour: deep blue overhead, a warm peach haze at the horizon. The
// horizon colour doubles as fog so distant terrain melts into the sky.
const ZENITH = new Color3(0.16, 0.22, 0.42)
const UPPER_SKY = new Color3(0.4, 0.47, 0.68)
const HORIZON = new Color3(0.95, 0.72, 0.55)
const SUN_GLOW = new Color3(1, 0.86, 0.6)
const FAR_RANGE = new Color3(0.5, 0.46, 0.6)
const NEAR_RANGE = new Color3(0.36, 0.33, 0.45)
/** Riding into a low sun, slightly to the left of the road. */
const SUN_DIRECTION = new Vector3(-0.42, 0.2, 0.88).normalize()
const SKY_RADIUS = 1500

function unlitMaterial(name: string, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  material.disableLighting = true
  material.diffuseColor = Color3.Black()
  material.specularColor = Color3.Black()
  material.emissiveColor = Color3.White()
  material.fogEnabled = false
  return material
}

function skyColor(direction: Vector3, result: Color3): Color3 {
  const elevation = direction.y
  Color3.LerpToRef(HORIZON, UPPER_SKY, smoothstep(0.02, 0.3, elevation), result)
  Color3.LerpToRef(result, ZENITH, smoothstep(0.3, 0.95, elevation), result)
  const facing = Math.max(0, Vector3.Dot(direction, SUN_DIRECTION))
  const glow = facing ** 6 * 0.55 + facing ** 64 * 0.6
  Color3.LerpToRef(result, SUN_GLOW, Math.min(1, glow), result)
  return result
}

function createSkyDome(scene: Scene, material: StandardMaterial): Mesh {
  const dome = MeshBuilder.CreateSphere('sky-dome', { diameter: SKY_RADIUS * 2, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene)
  const positions = dome.getVerticesData(VertexBuffer.PositionKind) ?? []
  const colors = new Float32Array((positions.length / 3) * 4)
  const direction = new Vector3()
  const color = new Color3()
  for (let index = 0; index < positions.length / 3; index += 1) {
    direction.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]).normalize()
    skyColor(direction, color)
    colors.set([color.r, color.g, color.b, 1], index * 4)
  }
  dome.setVerticesData(VertexBuffer.ColorKind, colors)
  dome.material = material
  dome.infiniteDistance = true
  return dome
}

function createSun(scene: Scene): { mesh: Mesh; texture: DynamicTexture; material: StandardMaterial } {
  const texture = new DynamicTexture('sun-texture', { width: 128, height: 128 }, scene, true)
  const context = texture.getContext() as CanvasRenderingContext2D
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255, 252, 235, 1)')
  gradient.addColorStop(0.18, 'rgba(255, 236, 190, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 200, 130, 0.45)')
  gradient.addColorStop(1, 'rgba(255, 170, 110, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  texture.update()
  texture.hasAlpha = true

  const material = unlitMaterial('sun-material', scene)
  material.emissiveTexture = texture
  material.opacityTexture = texture
  material.emissiveColor = Color3.Black()

  const mesh = MeshBuilder.CreatePlane('sun', { size: 260 }, scene)
  mesh.material = material
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
  mesh.infiniteDistance = true
  mesh.position.copyFrom(SUN_DIRECTION.scale(SKY_RADIUS * 0.9))
  return { mesh, texture, material }
}

/** A distant jagged ring that always stays on the horizon, like a painted backdrop. */
function createRange(scene: Scene, name: string, radius: number, peak: number, seed: number, top: Color3, material: StandardMaterial): Mesh {
  const steps = 240
  const base: Vector3[] = []
  const ridge: Vector3[] = []
  const colors: number[] = []
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2
    const x = Math.sin(angle)
    const z = Math.cos(angle)
    const n = fractalNoise(x * 3 + seed, z * 3 - seed, 5)
    const height = 25 + (1 - Math.abs(2 * n - 1)) ** 1.5 * peak
    base.push(new Vector3(x * radius, -80, z * radius))
    ridge.push(new Vector3(x * radius, height, z * radius))
  }
  const mesh = MeshBuilder.CreateRibbon(name, { pathArray: [base, ridge], sideOrientation: Mesh.DOUBLESIDE }, scene)
  // Double-sided ribbons duplicate their vertices, so colour by height rather than by index.
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? []
  for (let index = 1; index < positions.length; index += 3) {
    const color = positions[index] < 0 ? HORIZON : top
    colors.push(color.r, color.g, color.b, 1)
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors)
  mesh.material = material
  mesh.infiniteDistance = true
  return mesh
}

/**
 * Sky dome, sun, backdrop ranges, fog and lights for a golden-hour ride.
 * Everything is procedural, so no image assets are downloaded.
 */
export function createAtmosphere(scene: Scene): AtmosphereHandle {
  scene.clearColor = new Color4(HORIZON.r, HORIZON.g, HORIZON.b, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogColor = HORIZON.clone()
  scene.fogDensity = 0.0048

  const root = new TransformNode('atmosphere', scene)
  const skyMaterial = unlitMaterial('sky-material', scene)
  const dome = createSkyDome(scene, skyMaterial)
  const sun = createSun(scene)
  const far = createRange(scene, 'range-far', 1250, 230, 3.1, FAR_RANGE, skyMaterial)
  const near = createRange(scene, 'range-near', 1150, 140, 11.7, NEAR_RANGE, skyMaterial)
  for (const mesh of [dome, sun.mesh, far, near]) {
    mesh.parent = root
    mesh.isPickable = false
  }

  const hemisphere = new HemisphericLight('sky-light', new Vector3(0, 1, 0), scene)
  hemisphere.diffuse = new Color3(0.78, 0.76, 0.86)
  hemisphere.groundColor = new Color3(0.32, 0.26, 0.2)
  hemisphere.specular = Color3.Black()
  hemisphere.intensity = 0.95

  const light = new DirectionalLight('sun-light', SUN_DIRECTION.scale(-1), scene)
  light.diffuse = new Color3(1, 0.8, 0.58)
  light.specular = new Color3(1, 0.85, 0.65)
  light.intensity = 1.8

  let disposed = false
  return {
    sun: light,
    dispose: () => {
      if (disposed) return
      disposed = true
      root.dispose()
      skyMaterial.dispose()
      sun.material.dispose()
      sun.texture.dispose()
      hemisphere.dispose()
      light.dispose()
    },
  }
}
