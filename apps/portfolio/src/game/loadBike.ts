import { AssetsManager } from '@babylonjs/core/Misc/assetsManager'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

export interface BikeAsset {
  root: TransformNode
  wheels: readonly Mesh[]
  wheelRadius: number
}

export interface ProceduralBikeOptions {
  name?: string
}

const WHEEL_RADIUS = 0.42

/**
 * Creates the self-contained bike used until an approved production model is
 * supplied. All parts are parented to `root`, so callers can move it as one.
 */
export function createProceduralBike(scene: Scene, { name = 'bike' }: ProceduralBikeOptions = {}): BikeAsset {
  const root = new TransformNode(name, scene)
  // The authored procedural parts point toward local -Z. Rotate the complete
  // model once so increasing route Z (the controller's advance direction) is
  // visibly forward, toward the headlight and fork.
  root.rotation.y = Math.PI
  const paint = new StandardMaterial(`${name}-paint`, scene)
  paint.diffuseColor = new Color3(0.48, 0.035, 0.02)
  paint.specularColor = new Color3(0.7, 0.7, 0.7)

  const metal = new StandardMaterial(`${name}-metal`, scene)
  metal.diffuseColor = new Color3(0.08, 0.09, 0.1)
  metal.specularColor = new Color3(0.8, 0.8, 0.8)

  const addBox = (part: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateBox(`${name}-${part}`, { width, height, depth }, scene)
    mesh.position.set(x, y, z)
    mesh.material = material
    mesh.parent = root
    return mesh
  }

  // A low, long silhouette: tank, engine, seat, fork, and handlebars.
  addBox('frame', 0.24, 0.24, 2.15, 0, WHEEL_RADIUS + 0.28, 0, metal)
  addBox('tank', 0.9, 0.42, 0.88, 0, WHEEL_RADIUS + 0.68, -0.25, paint)
  addBox('engine', 0.68, 0.52, 0.58, 0, WHEEL_RADIUS + 0.4, 0.28, metal)
  addBox('seat', 0.72, 0.18, 0.66, 0, WHEEL_RADIUS + 0.76, 0.67, metal)
  const fork = addBox('fork', 0.16, 1.18, 0.16, 0, WHEEL_RADIUS + 0.53, -1.03, metal)
  fork.rotation.x = -0.3
  addBox('handlebars', 1.04, 0.1, 0.14, 0, WHEEL_RADIUS + 1.14, -1.18, metal)
  addBox('headlight', 0.34, 0.25, 0.16, 0, WHEEL_RADIUS + 0.94, -1.29, paint)

  const wheels = [-1.12, 1.12].map((z, index) => {
    const wheel = MeshBuilder.CreateCylinder(`${name}-wheel-${index}`, { diameter: WHEEL_RADIUS * 2, height: 0.22, tessellation: 24 }, scene)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(0, WHEEL_RADIUS, z)
    wheel.material = metal
    wheel.parent = root
    return wheel
  })

  return { root, wheels, wheelRadius: WHEEL_RADIUS }
}

export interface BikeGlbSource {
  /** Directory URL containing the approved GLB. */
  rootUrl: string
  /** GLB filename supplied by the caller; no model path is assumed here. */
  fileName: string
}

/**
 * Boundary for a future approved GLB. This intentionally requires a caller
 * supplied source; the current application should use `createProceduralBike`.
 */
export async function loadBikeGlb(scene: Scene, { rootUrl, fileName }: BikeGlbSource): Promise<BikeAsset> {
  // Register the GLB plugin only for callers that actually request a GLB. The
  // portfolio itself remains self-contained and uses the procedural fallback.
  await import('@babylonjs/loaders/glTF')
  return new Promise((resolve, reject) => {
    const manager = new AssetsManager(scene)
    manager.useDefaultLoadingScreen = false
    const task = manager.addMeshTask('load-bike-glb', '', rootUrl, fileName, '.glb')

    task.onSuccess = (completedTask) => {
      const root = new TransformNode('bike', scene)
      for (const node of [...completedTask.loadedTransformNodes, ...completedTask.loadedMeshes]) {
        if (!node.parent) node.parent = root
      }
      resolve({ root, wheels: [], wheelRadius: WHEEL_RADIUS })
    }
    task.onError = (_task, message, exception) => {
      reject(exception instanceof Error ? exception : new Error(message ?? `Could not load ${fileName}`))
    }
    manager.load()
  })
}
