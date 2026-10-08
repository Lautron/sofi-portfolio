import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Matrix, Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import type { Scene } from '@babylonjs/core/scene'
import { paintMesh } from './paintMesh'

export interface CreateRoadOptions {
  length?: number
  name?: string
  width?: number
  /** Gravel strip on each side of the asphalt. */
  shoulderWidth?: number
}

export interface RoadHandle {
  dispose: () => void
  root: TransformNode
  /** Meshes that should receive the bike's shadow. */
  surfaces: readonly Mesh[]
}

export interface RoadSample {
  /** Centre of the road at the clamped route Z coordinate, including its elevation. */
  center: Vector3
  /** Horizontal unit direction for increasing route Z. */
  tangent: Vector3
  /** Horizontal unit direction across the road, to the right when travelling forward. */
  lateral: Vector3
  /** Babylon Y-axis rotation that points local +Z along `tangent`. */
  yaw: number
  /** Climb angle in radians; positive when the road rises with increasing Z. */
  pitch: number
  /** Signed horizontal curvature (1 / radius); positive when the road bends right. */
  curvature: number
}

/** Samples a road centreline at route Z; returned centre Z is always within the route bounds. */
export type RoadSampler = (z: number) => RoadSample

export const DEFAULT_ROAD_LENGTH = 1040
const RIBBON_SEGMENT_LENGTH = 1.5
/** Road texture repeat, in world units; one dash and one gap per repeat. */
const TEXTURE_TILE_LENGTH = 9
const REFLECTOR_SPACING = 24

// Layered sines: a few long sweeping bends with shorter wiggles on top.
// [amplitude, wavelength / 2π, phase]
const BENDS = [
  [16, 90, 0.6],
  [7, 37, 2.1],
  [1.6, 17, 0.3],
] as const
const HILLS = [
  [4, 70, 0.4],
  [2, 29, 1.7],
] as const

// Past the last board the road climbs over a crest and drops away behind it,
// so a rider leaving the ride disappears over the top.
// [rise, start Z, end Z]; negative rises fall.
const FAREWELL_HILL = [
  [7, 350, 430],
  [-16, 440, 520],
] as const

function ramps(terms: readonly (readonly [number, number, number])[], z: number) {
  let value = 0
  let slope = 0
  for (const [rise, start, end] of terms) {
    const t = Math.min(1, Math.max(0, (z - start) / (end - start)))
    value += rise * t * t * (3 - 2 * t)
    slope += (rise * 6 * t * (1 - t)) / (end - start)
  }
  return { value, slope }
}

function wave(terms: readonly (readonly [number, number, number])[], z: number) {
  let value = 0
  let slope = 0
  let bend = 0
  for (const [amplitude, scale, phase] of terms) {
    const angle = z / scale + phase
    value += amplitude * Math.sin(angle)
    slope += (amplitude / scale) * Math.cos(angle)
    bend -= (amplitude / (scale * scale)) * Math.sin(angle)
  }
  return { value, slope, bend }
}

/**
 * Makes the deterministic route geometry shared by the road surface, terrain
 * and any route-following objects. Input Z is clamped, so sampled route Z is
 * monotonic.
 */
export function createRoadSampler(length = DEFAULT_ROAD_LENGTH): RoadSampler {
  const safeLength = Number.isFinite(length) && length > 0 ? length : DEFAULT_ROAD_LENGTH
  const halfLength = safeLength / 2

  return (z) => {
    const clampedZ = Math.min(halfLength, Math.max(-halfLength, Number.isNaN(z) ? 0 : z))
    const x = wave(BENDS, clampedZ)
    const hills = wave(HILLS, clampedZ)
    const farewell = ramps(FAREWELL_HILL, clampedZ)
    const y = { value: hills.value + farewell.value, slope: hills.slope + farewell.slope }
    const stretch = Math.hypot(x.slope, 1)
    const tangent = new Vector3(x.slope / stretch, 0, 1 / stretch)
    const lateral = new Vector3(tangent.z, 0, -tangent.x)

    return {
      center: new Vector3(x.value, y.value, clampedZ),
      tangent,
      lateral,
      yaw: Math.atan2(tangent.x, tangent.z),
      pitch: Math.atan(y.slope / stretch),
      curvature: x.bend / stretch ** 3,
    }
  }
}

/**
 * Signed horizontal distance from the road centreline, positive to the right.
 * Exact on straights and close enough on these gentle bends for placing scenery.
 */
export function roadOffset(sampler: RoadSampler, x: number, z: number): number {
  const sample = sampler(z)
  return (x - sample.center.x) * sample.tangent.z
}

function createAsphaltTexture(name: string, scene: Scene): DynamicTexture {
  const width = 256
  const height = 512
  const texture = new DynamicTexture(name, { width, height }, scene, true)
  const context = texture.getContext()
  context.fillStyle = '#2b2b2f'
  context.fillRect(0, 0, width, height)

  // Aggregate speckle so the surface reads as asphalt when it rushes by.
  let seed = 7
  const next = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let index = 0; index < 5000; index += 1) {
    const shade = 30 + Math.floor(next() * 40)
    context.fillStyle = `rgb(${shade}, ${shade}, ${shade + 4})`
    context.fillRect(next() * width, next() * height, 1 + next() * 2, 1 + next() * 2)
  }
  // Darker tyre lanes worn into each half of the road.
  context.fillStyle = 'rgba(10, 10, 12, 0.22)'
  for (const lane of [0.27, 0.73]) context.fillRect(width * lane - 18, 0, 36, height)

  context.fillStyle = '#e8e4de'
  context.fillRect(width * 0.04, 0, 7, height)
  context.fillRect(width * 0.96 - 7, 0, 7, height)
  context.fillStyle = '#f2c230'
  context.fillRect(width / 2 - 4, 0, 8, height * 0.45)
  texture.update(true)

  texture.wrapU = Texture.CLAMP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE
  // The road is mostly seen at a grazing angle from the chase camera.
  texture.anisotropicFilteringLevel = 8
  return texture
}

function buildStrip(
  name: string,
  scene: Scene,
  sampleRoad: RoadSampler,
  length: number,
  inner: number,
  outer: number,
  innerDrop: number,
  outerDrop: number,
  withUvs: boolean,
): Mesh {
  const segmentCount = Math.max(2, Math.ceil(length / RIBBON_SEGMENT_LENGTH))
  const near: Vector3[] = []
  const far: Vector3[] = []
  const nearUvs: Vector2[] = []
  const farUvs: Vector2[] = []
  let distance = 0
  let previous: Vector3 | undefined
  for (let index = 0; index <= segmentCount; index += 1) {
    const z = -length / 2 + (length * index) / segmentCount
    const { center, lateral } = sampleRoad(z)
    near.push(center.add(lateral.scale(inner)).addInPlaceFromFloats(0, -innerDrop, 0))
    far.push(center.add(lateral.scale(outer)).addInPlaceFromFloats(0, -outerDrop, 0))
    if (previous) distance += Vector3.Distance(previous, center)
    previous = center
    nearUvs.push(new Vector2(0, distance / TEXTURE_TILE_LENGTH))
    farUvs.push(new Vector2(1, distance / TEXTURE_TILE_LENGTH))
  }
  return MeshBuilder.CreateRibbon(
    name,
    {
      pathArray: [near, far],
      sideOrientation: Mesh.DOUBLESIDE,
      uvs: withUvs ? [...nearUvs, ...farUvs] : undefined,
    },
    scene,
  )
}

/** Creates a textured, winding, rolling road with gravel shoulders and reflector posts. */
export function createRoad(scene: Scene, options: CreateRoadOptions = {}): RoadHandle {
  const {
    length = DEFAULT_ROAD_LENGTH,
    name = 'cv-road',
    width = 8,
    shoulderWidth = 1.6,
  } = options
  const root = new TransformNode(name, scene)
  const sampleRoad = createRoadSampler(length)
  const halfWidth = width / 2

  const asphalt = createAsphaltTexture(`${name}-asphalt`, scene)
  const roadMaterial = new StandardMaterial(`${name}-material`, scene)
  roadMaterial.diffuseTexture = asphalt
  roadMaterial.specularColor = new Color3(0.08, 0.08, 0.08)

  // The terrain is carved just below the road, so the asphalt never z-fights it.
  const road = buildStrip(`${name}-surface`, scene, sampleRoad, length, -halfWidth, halfWidth, -0.02, -0.02, true)
  road.material = roadMaterial
  road.parent = root

  const shoulderMaterial = new StandardMaterial(`${name}-shoulder-material`, scene)
  shoulderMaterial.diffuseColor = new Color3(0.42, 0.36, 0.28)
  shoulderMaterial.specularColor = Color3.Black()
  const shoulders = [-1, 1].map((side) => {
    const shoulder = buildStrip(
      `${name}-shoulder-${side}`,
      scene,
      sampleRoad,
      length,
      side * halfWidth,
      side * (halfWidth + shoulderWidth),
      -0.015,
      0.3,
      false,
    )
    shoulder.material = shoulderMaterial
    shoulder.parent = root
    return shoulder
  })

  // White posts with an amber reflector; one thin-instanced mesh for all of them.
  const postMaterial = new StandardMaterial(`${name}-post-material`, scene)
  postMaterial.specularColor = new Color3(0.2, 0.2, 0.2)
  // Taller than they look: the bottom 0.3 is sunk into the verge.
  const postBody = MeshBuilder.CreateBox(`${name}-post-body`, { width: 0.12, height: 1.3, depth: 0.12 }, scene)
  postBody.position.y = 0.65
  paintMesh(postBody, new Color3(0.9, 0.88, 0.84))
  const reflector = MeshBuilder.CreateBox(`${name}-post-reflector`, { width: 0.13, height: 0.16, depth: 0.13 }, scene)
  reflector.position.y = 1.16
  paintMesh(reflector, new Color3(1, 0.55, 0.1))
  const post = Mesh.MergeMeshes([postBody, reflector], true, true) as Mesh
  post.name = `${name}-posts`
  post.material = postMaterial
  post.parent = root
  post.isPickable = false
  const postMatrices: number[] = []
  const postOffset = halfWidth + shoulderWidth + 0.4
  for (let z = -length / 2 + REFLECTOR_SPACING / 2; z < length / 2; z += REFLECTOR_SPACING) {
    const sample = sampleRoad(z)
    for (const side of [-1, 1]) {
      const position = sample.center.add(sample.lateral.scale(side * postOffset))
      position.y -= 0.42
      Matrix.RotationY(sample.yaw)
        .multiply(Matrix.Translation(position.x, position.y, position.z))
        .copyToArray(postMatrices, postMatrices.length)
    }
  }
  post.thinInstanceSetBuffer('matrix', new Float32Array(postMatrices), 16, true)

  for (const mesh of [road, ...shoulders, post]) {
    mesh.isPickable = false
    mesh.freezeWorldMatrix()
  }

  let disposed = false
  return {
    root,
    surfaces: [road, ...shoulders],
    dispose: () => {
      if (disposed) return
      disposed = true
      root.dispose()
      roadMaterial.dispose()
      asphalt.dispose()
      shoulderMaterial.dispose()
      postMaterial.dispose()
    },
  }
}
