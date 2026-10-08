import '@babylonjs/loaders/glTF/2.0/glTFLoader'
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_mesh_quantization'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Material } from '@babylonjs/core/Materials/material'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { createRider, type Rider, type RiderFit } from './createRider'

export interface BikeAsset {
  /** Follows the road: position, heading and slope. */
  root: TransformNode
  /** Child of `root` that leans into bends, pivoting on the tyre contact line. */
  body: TransformNode
  wheels: readonly TransformNode[]
  wheelRadius: number
  /** Seated on `body`; its hair needs updating every frame. */
  rider: Rider
  /** Everything that should cast the bike's shadow. */
  meshes: readonly AbstractMesh[]
}

export interface LoadBikeOptions {
  name?: string
}

/** Axle to axle, so the ride's camera and shadow framing fit the bike. */
export const WHEELBASE = 2.3
/** Node names in assets/source/moto.fbx. */
const FRONT_WHEEL = 'RuedaDelantera'
const REAR_WHEEL = 'RuedaTrasera'
/** Measured on the normalized model: the saddle's dip, grips and footrests. */
const RIDER_FIT: RiderFit = {
  seat: new Vector3(0, 1.1, -0.6),
  grip: new Vector3(0.51, 1.58, 0.48),
  // The model has no footrests; feet rest where forward controls would be.
  footrest: new Vector3(0.3, 0.5, 0.3),
}

interface Finish {
  specular: number
  power: number
  emissive?: boolean
}

/**
 * Golden-hour finishes for the FBX's Phong materials, by material name. The
 * artist's diffuse colours are kept; the ride is lit for StandardMaterial and
 * has no environment map for glTF's metallic PBR to reflect.
 */
const FINISHES: Record<string, Finish> = {
  Pintura: { specular: 0.9, power: 96 },
  Metal: { specular: 1, power: 128 },
  'Metal 2': { specular: 0.6, power: 64 },
  'Metal 3': { specular: 0.5, power: 32 },
  Asiento: { specular: 0.25, power: 16 },
  Neumatico: { specular: 0.08, power: 8 },
  Luz: { specular: 0, power: 1, emissive: true },
}
const DEFAULT_FINISH: Finish = { specular: 0.3, power: 24 }

/**
 * Loads the motorbike GLB (converted from assets/source/moto.fbx by
 * `npm run convert:bike`) and seats the rider on it.
 *
 * The model is normalized here rather than in the export, so the artist can
 * re-export it as is: it is turned to face local +Z (the route's forward
 * direction), scaled to `WHEELBASE`, centred between the axles and set on its
 * tyres at y = 0. Each wheel spins about its own axle pivot.
 */
export async function loadBike(scene: Scene, source: string | ArrayBufferView, { name = 'bike' }: LoadBikeOptions = {}): Promise<BikeAsset> {
  const container = await LoadAssetContainerAsync(source, scene, { pluginExtension: '.glb' })
  container.addAllToScene()

  const root = new TransformNode(name, scene)
  const body = new TransformNode(`${name}-body`, scene)
  body.parent = root
  // Rotates, scales and places the model under the leaning body.
  const frame = new TransformNode(`${name}-frame`, scene)
  frame.parent = body
  for (const node of container.rootNodes) node.parent = frame

  const findWheel = (wheelName: string): TransformNode => {
    const node = [...container.transformNodes, ...container.meshes].find((candidate) => candidate.name === wheelName)
    if (!node) throw new Error(`The bike model has no ${wheelName} node.`)
    return node
  }
  const wheelNodes = [findWheel(FRONT_WHEEL), findWheel(REAR_WHEEL)]
  // Bounding boxes of the tilted wheel nodes overstate the tyres, so measure
  // the actual vertices.
  const measureWheel = (node: TransformNode) => {
    frame.computeWorldMatrix(true)
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = min.negate()
    const point = new Vector3()
    for (const mesh of node.getChildMeshes(false)) {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? []
      const world = mesh.computeWorldMatrix(true)
      for (let index = 0; index < positions.length; index += 3) {
        Vector3.TransformCoordinatesFromFloatsToRef(positions[index], positions[index + 1], positions[index + 2], world, point)
        min.minimizeInPlace(point)
        max.maximizeInPlace(point)
      }
    }
    return { centre: min.add(max).scaleInPlace(0.5), radius: (max.y - min.y) / 2 }
  }

  // Face +Z at the target wheelbase. Root and body are still at the origin, so
  // world space is body space.
  const [front, rear] = wheelNodes.map(measureWheel)
  const axis = front.centre.subtract(rear.centre)
  axis.y = 0
  frame.rotation.y = -Math.atan2(axis.x, axis.z)
  frame.scaling.setAll(WHEELBASE / axis.length())

  // Centre between the axles with both tyres on the ground.
  const [frontPlaced, rearPlaced] = wheelNodes.map(measureWheel)
  const ground = Math.min(frontPlaced.centre.y - frontPlaced.radius, rearPlaced.centre.y - rearPlaced.radius)
  frame.position.set(
    -(frontPlaced.centre.x + rearPlaced.centre.x) / 2,
    -ground,
    -(frontPlaced.centre.z + rearPlaced.centre.z) / 2,
  )

  const wheels = wheelNodes.map((node, index) => {
    const { centre } = measureWheel(node)
    const wheel = new TransformNode(`${name}-wheel-${index}`, scene)
    wheel.parent = body
    wheel.position.copyFrom(centre)
    node.setParent(wheel)
    return wheel
  })
  const wheelRadius = (frontPlaced.radius + rearPlaced.radius) / 2

  const materials = new Map<Material, StandardMaterial>()
  const restyle = (original: Material): StandardMaterial => {
    const albedo = (original as { albedoColor?: Color3 }).albedoColor ?? Color3.Gray()
    const { specular, power, emissive } = FINISHES[original.name] ?? DEFAULT_FINISH
    const material = new StandardMaterial(`${name}-${original.name}`, scene)
    material.diffuseColor = albedo.clone()
    material.specularColor = new Color3(specular, specular, specular)
    material.specularPower = power
    if (emissive) material.emissiveColor = albedo.clone()
    return material
  }
  const meshes = container.meshes.filter((mesh) => mesh.getTotalVertices() > 0)
  for (const mesh of meshes) {
    mesh.isPickable = false
    if (!mesh.material) continue
    let material = materials.get(mesh.material)
    if (!material) {
      material = restyle(mesh.material)
      materials.set(mesh.material, material)
    }
    mesh.material = material
  }
  // Disposing a material removes it from the container's list, so walk a copy.
  for (const original of [...container.materials]) original.dispose()

  const rider = createRider(scene, { name: `${name}-rider`, ...RIDER_FIT })
  rider.root.parent = body

  root.onDisposeObservable.addOnce(() => {
    for (const material of materials.values()) material.dispose()
  })

  return {
    root,
    body,
    wheels,
    wheelRadius,
    rider,
    meshes: [...meshes, ...rider.meshes],
  }
}
