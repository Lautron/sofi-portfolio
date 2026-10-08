import { AssetsManager } from '@babylonjs/core/Misc/assetsManager'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Curve3 } from '@babylonjs/core/Maths/math.path'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

export interface BikeAsset {
  /** Follows the road: position, heading and slope. */
  root: TransformNode
  /** Child of `root` that leans into bends, pivoting on the tyre contact line. */
  body: TransformNode
  wheels: readonly TransformNode[]
  wheelRadius: number
  /** Everything that should cast the bike's shadow. */
  meshes: readonly AbstractMesh[]
}

export interface ProceduralBikeOptions {
  name?: string
}

const WHEEL_RADIUS = 0.42
const FRONT_AXLE = new Vector3(0, WHEEL_RADIUS, 1.2)
const REAR_AXLE = new Vector3(0, WHEEL_RADIUS, -1.1)
const UP = Vector3.Up()

/**
 * A procedural cruiser with its rider, authored facing local +Z (the route's
 * forward direction). Parts are merged per material to keep draw calls low.
 */
export function createProceduralBike(scene: Scene, { name = 'bike' }: ProceduralBikeOptions = {}): BikeAsset {
  const root = new TransformNode(name, scene)
  const body = new TransformNode(`${name}-body`, scene)
  body.parent = root

  const material = (part: string, diffuse: Color3, specular: number, power = 32): StandardMaterial => {
    const result = new StandardMaterial(`${name}-${part}`, scene)
    result.diffuseColor = diffuse
    result.specularColor = new Color3(specular, specular, specular)
    result.specularPower = power
    return result
  }
  const paint = material('paint', new Color3(0.52, 0.06, 0.08), 0.9, 96)
  const chrome = material('chrome', new Color3(0.4, 0.4, 0.43), 1, 128)
  chrome.emissiveColor = new Color3(0.05, 0.05, 0.05)
  const frame = material('frame', new Color3(0.05, 0.05, 0.06), 0.6, 64)
  const alloy = material('alloy', new Color3(0.42, 0.42, 0.44), 0.5, 32)
  const rubber = material('rubber', new Color3(0.04, 0.04, 0.045), 0.08, 8)
  const leather = material('leather', new Color3(0.13, 0.08, 0.06), 0.25, 16)
  const jacket = material('jacket', new Color3(0.42, 0.06, 0.07), 0.3, 24)
  const denim = material('denim', new Color3(0.13, 0.16, 0.24), 0.05, 8)
  const helmet = material('helmet', new Color3(0.07, 0.07, 0.08), 0.9, 128)
  const headlamp = material('headlamp', new Color3(1, 0.95, 0.8), 0)
  headlamp.emissiveColor = new Color3(1, 0.92, 0.72)
  const taillamp = material('taillamp', new Color3(0.9, 0.05, 0.05), 0)
  taillamp.emissiveColor = new Color3(1, 0.08, 0.06)
  const materials = [paint, chrome, frame, alloy, rubber, leather, jacket, denim, helmet, headlamp, taillamp]

  const parts = new Map<StandardMaterial, Mesh[]>()
  const add = (mesh: Mesh, partMaterial: StandardMaterial): Mesh => {
    mesh.material = partMaterial
    parts.set(partMaterial, [...(parts.get(partMaterial) ?? []), mesh])
    return mesh
  }
  const tube = (from: Vector3, to: Vector3, radius: number, partMaterial: StandardMaterial, tessellation = 10): Mesh => {
    const direction = to.subtract(from)
    const mesh = MeshBuilder.CreateCylinder('part', { height: direction.length(), diameter: radius * 2, tessellation }, scene)
    mesh.position.copyFrom(from.add(to).scaleInPlace(0.5))
    mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(UP, direction.normalize(), new Quaternion())
    return add(mesh, partMaterial)
  }
  const pipe = (points: Vector3[], radius: number, partMaterial: StandardMaterial): Mesh => {
    const path = Curve3.CreateCatmullRomSpline(points, 8).getPoints()
    return add(MeshBuilder.CreateTube('part', { path, radius, tessellation: 10, cap: Mesh.CAP_ALL }, scene), partMaterial)
  }
  const ellipsoid = (position: Vector3, size: Vector3, partMaterial: StandardMaterial, tiltX = 0): Mesh => {
    const mesh = MeshBuilder.CreateSphere('part', { segments: 12, diameterX: size.x, diameterY: size.y, diameterZ: size.z }, scene)
    mesh.position.copyFrom(position)
    mesh.rotation.x = tiltX
    return add(mesh, partMaterial)
  }
  const box = (position: Vector3, size: Vector3, partMaterial: StandardMaterial, tiltX = 0): Mesh => {
    const mesh = MeshBuilder.CreateBox('part', { width: size.x, height: size.y, depth: size.z }, scene)
    mesh.position.copyFrom(position)
    mesh.rotation.x = tiltX
    return add(mesh, partMaterial)
  }
  /** A disc whose axis runs along X (wheels, filters) or Z (lamps). */
  const disc = (position: Vector3, diameter: number, thickness: number, axis: 'x' | 'z', partMaterial: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateCylinder('part', { diameter, height: thickness, tessellation: 20 }, scene)
    mesh.position.copyFrom(position)
    if (axis === 'x') mesh.rotation.z = Math.PI / 2
    else mesh.rotation.x = Math.PI / 2
    return add(mesh, partMaterial)
  }
  /** A curved strip around an axle, for mudguards. Angles run from forward (+Z) over the top. */
  const fender = (axle: Vector3, radius: number, halfWidth: number, from: number, to: number): Mesh => {
    const edges = [-halfWidth, halfWidth].map((x) => {
      const points: Vector3[] = []
      for (let step = 0; step <= 16; step += 1) {
        const angle = from + ((to - from) * step) / 16
        points.push(new Vector3(x, axle.y + Math.sin(angle) * radius, axle.z + Math.cos(angle) * radius))
      }
      return points
    })
    return add(MeshBuilder.CreateRibbon('part', { pathArray: edges, sideOrientation: Mesh.DOUBLESIDE }, scene), paint)
  }
  const mirrored = (build: (side: number) => void) => [-1, 1].forEach(build)
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

  // ---- Front end: raked fork, lamp, pull-back bars --------------------------
  const forkTop = v(0, 1.2, 0.8)
  const forkAxis = forkTop.subtract(FRONT_AXLE).normalize()
  mirrored((side) => {
    const axle = FRONT_AXLE.add(v(side * 0.13, 0, 0))
    const top = forkTop.add(v(side * 0.13, 0, 0))
    tube(axle, top, 0.035, chrome)
    tube(axle, axle.add(forkAxis.scale(0.38)), 0.055, frame)
  })
  box(forkTop, v(0.42, 0.07, 0.14), frame)
  disc(v(0, 1.12, 0.98), 0.32, 0.2, 'z', chrome)
  disc(v(0, 1.12, 1.085), 0.26, 0.02, 'z', headlamp)
  pipe([v(-0.46, 1.37, 0.6), v(-0.32, 1.39, 0.66), v(-0.14, 1.32, 0.8), v(0.14, 1.32, 0.8), v(0.32, 1.39, 0.66), v(0.46, 1.37, 0.6)], 0.022, chrome)
  mirrored((side) => {
    tube(v(side * 0.3, 1.38, 0.67), v(side * 0.36, 1.62, 0.7), 0.012, chrome)
    disc(v(side * 0.36, 1.64, 0.7), 0.13, 0.02, 'z', chrome)
    tube(v(side * 0.34, 1.375, 0.63), v(side * 0.48, 1.365, 0.59), 0.03, rubber)
  })
  fender(FRONT_AXLE, WHEEL_RADIUS + 0.07, 0.1, 0.5, 2.3)

  // ---- Tank, frame, seat ---------------------------------------------------
  ellipsoid(v(0, 1.08, 0.3), v(0.48, 0.36, 0.98), paint, -0.08)
  tube(v(0, 1.24, 0.38), v(0, 1.28, 0.38), 0.04, chrome)
  pipe([v(0, 1.12, 0.8), v(0, 0.45, 0.6), v(0, 0.3, 0.1), v(0, 0.32, -0.35), v(0, 0.62, -0.6), v(0, 0.98, -0.5), v(0, 1.08, 0.2), v(0, 1.12, 0.8)], 0.04, frame)
  mirrored((side) => {
    tube(v(side * 0.14, 0.98, -0.45), v(side * 0.17, 0.9, -1.3), 0.03, frame)
    // Swingarm and twin shocks.
    tube(REAR_AXLE.add(v(side * 0.17, 0, 0)), v(side * 0.15, 0.42, -0.42), 0.035, frame)
    tube(v(side * 0.17, 0.5, -1.0), v(side * 0.15, 0.95, -0.72), 0.03, chrome)
    // Forward controls.
    tube(v(side * 0.2, 0.42, 0.42), v(side * 0.36, 0.42, 0.42), 0.025, rubber)
  })
  ellipsoid(v(0, 1.0, -0.45), v(0.44, 0.16, 0.82), leather)
  ellipsoid(v(0, 1.06, -0.95), v(0.36, 0.13, 0.42), leather)
  fender(REAR_AXLE, WHEEL_RADIUS + 0.08, 0.16, 0.9, 3.0)
  box(v(0, 0.78, -1.55), v(0.18, 0.07, 0.07), taillamp, -0.6)

  // ---- V-twin engine and pipes ---------------------------------------------
  box(v(0, 0.5, 0.08), v(0.36, 0.32, 0.56), alloy)
  box(v(0, 0.48, -0.3), v(0.3, 0.28, 0.32), alloy)
  for (const [z, tilt] of [[0.26, 0.45], [-0.1, -0.45]] as const) {
    const cylinder = new TransformNode('cylinder', scene)
    cylinder.position.set(0, 0.68, z)
    cylinder.rotation.x = tilt
    const at = (height: number) => Vector3.TransformCoordinates(v(0, height, 0), cylinder.computeWorldMatrix(true))
    tube(at(0), at(0.42), 0.1, frame, 14)
    for (let fin = 1; fin <= 4; fin += 1) {
      // Cooling fins sit square to the tilted barrel.
      disc(at(fin * 0.08), 0.3 - fin * 0.015, 0.025, 'z', alloy).rotation.x = tilt
    }
    box(at(0.46), v(0.24, 0.1, 0.26), chrome, tilt)
    cylinder.dispose()
  }
  disc(v(0.22, 0.78, 0.08), 0.26, 0.07, 'x', chrome)
  pipe([v(0.08, 0.98, 0.5), v(0.22, 0.72, 0.56), v(0.25, 0.36, 0.3), v(0.26, 0.33, -0.5), v(0.27, 0.42, -1.25)], 0.045, chrome)
  pipe([v(0.08, 0.98, -0.32), v(0.22, 0.7, -0.38), v(0.28, 0.5, -0.6), v(0.29, 0.55, -1.2)], 0.045, chrome)
  tube(v(0.27, 0.4, -0.95), v(0.28, 0.46, -1.62), 0.075, chrome, 14)
  tube(v(0.29, 0.53, -0.95), v(0.3, 0.6, -1.58), 0.07, chrome, 14)

  // ---- Rider ---------------------------------------------------------------
  ellipsoid(v(0, 1.18, -0.42), v(0.38, 0.24, 0.32), denim)
  ellipsoid(v(0, 1.44, -0.32), v(0.46, 0.62, 0.32), jacket, 0.32)
  ellipsoid(v(0, 1.66, -0.22), v(0.52, 0.2, 0.28), jacket, 0.2)
  tube(v(0, 1.7, -0.2), v(0, 1.82, -0.16), 0.06, frame)
  ellipsoid(v(0, 1.92, -0.15), v(0.33, 0.34, 0.37), helmet)
  ellipsoid(v(0, 1.9, -0.05), v(0.27, 0.15, 0.2), frame)
  mirrored((side) => {
    tube(v(side * 0.25, 1.64, -0.22), v(side * 0.34, 1.42, 0.12), 0.07, jacket)
    tube(v(side * 0.34, 1.42, 0.12), v(side * 0.41, 1.38, 0.58), 0.058, jacket)
    ellipsoid(v(side * 0.41, 1.375, 0.6), v(0.11, 0.1, 0.13), frame)
    tube(v(side * 0.13, 1.16, -0.38), v(side * 0.25, 1.1, 0.18), 0.085, denim)
    tube(v(side * 0.25, 1.1, 0.18), v(side * 0.29, 0.52, 0.38), 0.07, denim)
    box(v(side * 0.29, 0.46, 0.43), v(0.13, 0.13, 0.27), frame)
  })

  const meshes: Mesh[] = []
  for (const [partMaterial, group] of parts) {
    const merged = Mesh.MergeMeshes(group, true, true) as Mesh
    merged.name = `${partMaterial.name}-parts`
    merged.material = partMaterial
    merged.parent = body
    merged.isPickable = false
    meshes.push(merged)
  }

  // ---- Wheels: tyre, rim, spokes and hub, spun as one node -----------------
  const wheels = [FRONT_AXLE, REAR_AXLE].map((axle, index) => {
    const wheel = new TransformNode(`${name}-wheel-${index}`, scene)
    wheel.parent = body
    wheel.position.copyFrom(axle)
    const tyreThickness = index === 0 ? 0.13 : 0.17
    const tyre = MeshBuilder.CreateTorus('tyre', { diameter: (WHEEL_RADIUS - tyreThickness / 2) * 2, thickness: tyreThickness, tessellation: 32 }, scene)
    tyre.rotation.z = Math.PI / 2
    tyre.material = rubber
    const rim = MeshBuilder.CreateTorus('rim', { diameter: (WHEEL_RADIUS - tyreThickness) * 2, thickness: 0.035, tessellation: 32 }, scene)
    rim.rotation.z = Math.PI / 2
    rim.material = chrome
    const wheelParts = [tyre, rim]
    const hub = MeshBuilder.CreateCylinder('hub', { diameter: 0.14, height: 0.18, tessellation: 12 }, scene)
    hub.rotation.z = Math.PI / 2
    hub.material = chrome
    wheelParts.push(hub)
    const spokeLength = WHEEL_RADIUS - tyreThickness
    for (let spoke = 0; spoke < 16; spoke += 1) {
      const angle = (spoke / 16) * Math.PI * 2
      const from = v(spoke % 2 ? 0.07 : -0.07, 0, 0)
      const to = v(0, Math.sin(angle) * spokeLength, Math.cos(angle) * spokeLength)
      const mesh = MeshBuilder.CreateCylinder('spoke', { height: to.subtract(from).length(), diameter: 0.012, tessellation: 4 }, scene)
      mesh.position.copyFrom(from.add(to).scaleInPlace(0.5))
      mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(UP, to.subtract(from).normalize(), new Quaternion())
      mesh.material = chrome
      wheelParts.push(mesh)
    }
    if (index === 0) {
      const brake = MeshBuilder.CreateCylinder('brake', { diameter: 0.32, height: 0.012, tessellation: 24 }, scene)
      brake.rotation.z = Math.PI / 2
      brake.position.x = 0.09
      brake.material = alloy
      wheelParts.push(brake)
    }
    const merged = Mesh.MergeMeshes(wheelParts, true, true, undefined, false, true) as Mesh
    merged.name = `${name}-wheel-${index}-mesh`
    merged.parent = wheel
    merged.isPickable = false
    meshes.push(merged)
    return wheel
  })

  root.onDisposeObservable.addOnce(() => {
    for (const partMaterial of materials) partMaterial.dispose()
  })

  return {
    root,
    body,
    wheels,
    wheelRadius: WHEEL_RADIUS,
    meshes,
  }
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
      const body = new TransformNode('bike-body', scene)
      body.parent = root
      for (const node of [...completedTask.loadedTransformNodes, ...completedTask.loadedMeshes]) {
        if (!node.parent) node.parent = body
      }
      resolve({
        root,
        body,
        wheels: [],
        wheelRadius: WHEEL_RADIUS,
        meshes: completedTask.loadedMeshes,
      })
    }
    task.onError = (_task, message, exception) => {
      reject(exception instanceof Error ? exception : new Error(message ?? `Could not load ${fileName}`))
    }
    manager.load()
  })
}
