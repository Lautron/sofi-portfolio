import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

export interface CreateRoadOptions {
  length?: number
  markerLength?: number
  markerSpacing?: number
  name?: string
  width?: number
}

export interface RoadHandle {
  dispose: () => void
  root: TransformNode
}

export interface RoadSample {
  /** Centre of the road at the clamped route Z coordinate. */
  center: Vector3
  /** Unit direction for increasing route Z. */
  tangent: Vector3
  /** Unit direction across the road, to the right when travelling forward. */
  lateral: Vector3
  /** Babylon Y-axis rotation that points local +Z along `tangent`. */
  yaw: number
}

/** Samples a road centreline at route Z; returned centre Z is always within the route bounds. */
export type RoadSampler = (z: number) => RoadSample

const DEFAULT_ROAD_LENGTH = 80
const CURVE_AMPLITUDE_RATIO = 0.025
const MAX_CURVE_AMPLITUDE = 2
const RIBBON_SEGMENT_LENGTH = 2

/**
 * Makes the deterministic route geometry shared by the road surface and any
 * route-following objects. Input Z is clamped, so sampled route Z is monotonic.
 */
export function createRoadSampler(length = DEFAULT_ROAD_LENGTH): RoadSampler {
  const safeLength = Number.isFinite(length) && length > 0 ? length : DEFAULT_ROAD_LENGTH
  const halfLength = safeLength / 2
  const amplitude = Math.min(safeLength * CURVE_AMPLITUDE_RATIO, MAX_CURVE_AMPLITUDE)

  return (z) => {
    const clampedZ = Math.min(halfLength, Math.max(-halfLength, Number.isNaN(z) ? 0 : z))
    const progress = (clampedZ + halfLength) / safeLength
    const centreX = amplitude * Math.sin(Math.PI * progress)
    const dxDz = (amplitude * Math.PI * Math.cos(Math.PI * progress)) / safeLength
    const tangentLength = Math.hypot(dxDz, 1)
    const tangent = new Vector3(dxDz / tangentLength, 0, 1 / tangentLength)
    const lateral = new Vector3(tangent.z, 0, -tangent.x)

    return {
      center: new Vector3(centreX, 0, clampedZ),
      tangent,
      lateral,
      yaw: Math.atan2(tangent.x, tangent.z),
    }
  }
}

/** Creates a self-contained road mesh with centre-line markers. */
export function createRoad(scene: Scene, options: CreateRoadOptions = {}): RoadHandle {
  const {
    length = 80,
    markerLength = 2.5,
    markerSpacing = 6,
    name = 'cv-road',
    width = 8,
  } = options
  const root = new TransformNode(name, scene)
  const roadMaterial = new StandardMaterial(`${name}-material`, scene)
  roadMaterial.diffuseColor = new Color3(0.09, 0.1, 0.12)
  const sampleRoad = createRoadSampler(length)

  const segmentCount = Math.max(2, Math.ceil(length / RIBBON_SEGMENT_LENGTH))
  const leftEdge: Vector3[] = []
  const rightEdge: Vector3[] = []
  for (let index = 0; index <= segmentCount; index += 1) {
    const z = -length / 2 + (length * index) / segmentCount
    const sample = sampleRoad(z)
    leftEdge.push(
      new Vector3(
        sample.center.x - sample.lateral.x * (width / 2),
        0.01,
        sample.center.z - sample.lateral.z * (width / 2),
      ),
    )
    rightEdge.push(
      new Vector3(
        sample.center.x + sample.lateral.x * (width / 2),
        0.01,
        sample.center.z + sample.lateral.z * (width / 2),
      ),
    )
  }
  // Keep the asphalt above the world ground; coplanar ground meshes shimmer.
  const road = MeshBuilder.CreateRibbon(
    `${name}-surface`,
    { pathArray: [leftEdge, rightEdge], sideOrientation: Mesh.DOUBLESIDE },
    scene,
  )
  road.material = roadMaterial
  road.parent = root

  const markerMaterial = new StandardMaterial(`${name}-marker-material`, scene)
  markerMaterial.diffuseColor = new Color3(0.95, 0.76, 0.2)
  const firstMarker = -length / 2 + markerSpacing / 2
  const lastMarker = length / 2 - markerSpacing / 2

  for (let z = firstMarker; z <= lastMarker; z += markerSpacing) {
    const sample = sampleRoad(z)
    const marker = MeshBuilder.CreateBox(
      `${name}-marker-${z}`,
      { width: 0.25, height: 0.02, depth: markerLength },
      scene,
    )
    marker.position.y = 0.025
    marker.position.x = sample.center.x
    marker.position.z = sample.center.z
    marker.rotation.y = sample.yaw
    marker.material = markerMaterial
    marker.parent = root
  }

  let disposed = false
  return {
    root,
    dispose: () => {
      if (disposed) return
      disposed = true
      root.dispose()
      roadMaterial.dispose()
      markerMaterial.dispose()
    },
  }
}
