import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
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

  const road = MeshBuilder.CreateGround(`${name}-surface`, { width, height: length }, scene)
  // Keep the asphalt above the world ground; coplanar ground meshes shimmer.
  road.position.y = 0.01
  road.material = roadMaterial
  road.parent = root

  const markerMaterial = new StandardMaterial(`${name}-marker-material`, scene)
  markerMaterial.diffuseColor = new Color3(0.95, 0.76, 0.2)
  const firstMarker = -length / 2 + markerSpacing / 2
  const lastMarker = length / 2 - markerSpacing / 2

  for (let z = firstMarker; z <= lastMarker; z += markerSpacing) {
    const marker = MeshBuilder.CreateBox(
      `${name}-marker-${z}`,
      { width: 0.25, height: 0.02, depth: markerLength },
      scene,
    )
    marker.position.y = 0.025
    marker.position.z = z
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
