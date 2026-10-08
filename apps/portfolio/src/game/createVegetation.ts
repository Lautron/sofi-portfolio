import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import type { Scene } from '@babylonjs/core/scene'
import { roadOffset, type RoadSampler } from './createRoad'
import { paintMesh } from './paintMesh'
import { between, createRandom, fractalNoise, type Random } from './random'

export interface ScatterRule {
  count: number
  /** Closest allowed distance from the road centreline. */
  minOffset: number
  /** Furthest distance from the road centreline. */
  maxOffset: number
  /** Above 1, items crowd towards the road where the rider can see them. */
  crowding: number
  minScale: number
  maxScale: number
  /** Skip spots this far above the road, e.g. trees above the tree line. */
  maxHeightAboveRoad?: number
  /**
   * From 0 to 1: how much of the land is left open. Higher values gather
   * items into groves with meadows between them.
   */
  patchiness?: number
}

export interface ScatterArea {
  roadSampler: RoadSampler
  heightAt: (x: number, z: number) => number
  minZ: number
  maxZ: number
  /** Circles kept clear, such as the CV boards. */
  clearings?: readonly { x: number; z: number; radius: number }[]
}

export interface Placement {
  x: number
  y: number
  z: number
  scale: number
  yaw: number
}

/** Deterministically scatters items beside the road, never on it or in a clearing. */
export function scatterAlongRoad(random: Random, area: ScatterArea, rule: ScatterRule): Placement[] {
  const placements: Placement[] = []
  const attempts = rule.count * 8
  for (let attempt = 0; attempt < attempts && placements.length < rule.count; attempt += 1) {
    const z = between(random, area.minZ, area.maxZ)
    const side = random() < 0.5 ? -1 : 1
    const offset = rule.minOffset + (rule.maxOffset - rule.minOffset) * random() ** rule.crowding
    const sample = area.roadSampler(z)
    const x = sample.center.x + side * offset * sample.lateral.x
    const placedZ = z + side * offset * sample.lateral.z
    if (Math.abs(roadOffset(area.roadSampler, x, placedZ)) < rule.minOffset) continue
    if (rule.patchiness && fractalNoise(x / 90, placedZ / 90, 3) < rule.patchiness) continue
    if (area.clearings?.some((clearing) => Math.hypot(clearing.x - x, clearing.z - placedZ) < clearing.radius)) continue
    const y = area.heightAt(x, placedZ)
    if (rule.maxHeightAboveRoad !== undefined && y - sample.center.y > rule.maxHeightAboveRoad) continue
    placements.push({ x, y, z: placedZ, scale: between(random, rule.minScale, rule.maxScale), yaw: random() * Math.PI * 2 })
  }
  return placements
}

export interface VegetationHandle {
  root: TransformNode
  dispose: () => void
}

interface Kind {
  name: string
  build: (scene: Scene, random: Random) => Mesh
  rule: ScatterRule
  /** How far into the ground the base is pushed, as a fraction of scale. */
  sink: number
  /** Per-instance colour multipliers; one is picked at random. */
  tints: readonly Color3[]
  tilt: number
}

const merge = (parts: Mesh[]): Mesh => Mesh.MergeMeshes(parts, true, true) as Mesh

function cone(scene: Scene, diameter: number, height: number, y: number, color: Color3): Mesh {
  const mesh = MeshBuilder.CreateCylinder('cone', { diameterTop: 0, diameterBottom: diameter, height, tessellation: 7 }, scene)
  mesh.position.y = y
  return paintMesh(mesh, color)
}

function blob(scene: Scene, radius: number, position: Vector3, color: Color3, random: Random, jitter = 0.18): Mesh {
  const mesh = MeshBuilder.CreateIcoSphere('blob', { radius, subdivisions: 1, flat: true }, scene)
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? []
  // Flat icospheres repeat corners per face; displace by corner so faces stay closed.
  const offsets = new Map<string, number>()
  for (let index = 0; index < positions.length; index += 3) {
    const key = `${positions[index].toFixed(3)},${positions[index + 1].toFixed(3)},${positions[index + 2].toFixed(3)}`
    if (!offsets.has(key)) offsets.set(key, 1 + (random() * 2 - 1) * jitter)
    const scale = offsets.get(key) ?? 1
    for (let axis = 0; axis < 3; axis += 1) positions[index + axis] *= scale
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
  // Corners are unshared, so this yields one facet normal per face.
  const normals: number[] = []
  VertexData.ComputeNormals(positions, mesh.getIndices(), normals)
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
  mesh.position.copyFrom(position)
  return paintMesh(mesh, color)
}

const BARK = new Color3(0.3, 0.2, 0.13)

const kinds: readonly Kind[] = [
  {
    name: 'pine',
    build: (scene) => {
      const trunk = paintMesh(MeshBuilder.CreateCylinder('trunk', { diameterTop: 0.18, diameterBottom: 0.3, height: 1.4, tessellation: 6 }, scene), BARK)
      trunk.position.y = 0.7
      return merge([
        trunk,
        cone(scene, 2.6, 2.6, 2.1, new Color3(0.12, 0.26, 0.15)),
        cone(scene, 2.0, 2.2, 3.3, new Color3(0.14, 0.3, 0.16)),
        cone(scene, 1.3, 1.8, 4.4, new Color3(0.17, 0.33, 0.18)),
      ])
    },
    rule: { count: 1500, minOffset: 10, maxOffset: 170, crowding: 2.4, minScale: 0.8, maxScale: 2.3, maxHeightAboveRoad: 55, patchiness: 0.42 },
    sink: 0.15,
    tints: [new Color3(1, 1, 1), new Color3(0.85, 0.95, 0.9), new Color3(1.1, 1.05, 0.9)],
    tilt: 0.04,
  },
  {
    name: 'broadleaf',
    build: (scene, random) => {
      const trunk = paintMesh(MeshBuilder.CreateCylinder('trunk', { diameterTop: 0.22, diameterBottom: 0.38, height: 2.4, tessellation: 6 }, scene), BARK)
      trunk.position.y = 1.2
      const leaves = new Color3(0.55, 0.56, 0.22)
      return merge([
        trunk,
        blob(scene, 1.5, new Vector3(0, 3.2, 0), leaves, random),
        blob(scene, 1.1, new Vector3(0.9, 2.7, 0.3), leaves, random),
        blob(scene, 1.0, new Vector3(-0.7, 2.9, -0.5), leaves, random),
      ])
    },
    rule: { count: 700, minOffset: 9, maxOffset: 90, crowding: 2.2, minScale: 0.8, maxScale: 1.7, maxHeightAboveRoad: 30, patchiness: 0.38 },
    sink: 0.1,
    // Mostly green, with some trees turning amber.
    tints: [new Color3(0.6, 1, 0.75), new Color3(0.7, 0.95, 0.7), new Color3(1.15, 0.85, 0.55), new Color3(1.2, 0.7, 0.45)],
    tilt: 0.05,
  },
  {
    name: 'bush',
    build: (scene, random) => {
      const leaves = new Color3(0.36, 0.48, 0.2)
      return merge([
        blob(scene, 0.7, new Vector3(0, 0.45, 0), leaves, random),
        blob(scene, 0.5, new Vector3(0.55, 0.32, 0.2), leaves, random),
        blob(scene, 0.45, new Vector3(-0.45, 0.3, -0.25), leaves, random),
      ])
    },
    rule: { count: 1000, minOffset: 6.5, maxOffset: 60, crowding: 2.2, minScale: 0.7, maxScale: 1.6, maxHeightAboveRoad: 35, patchiness: 0.3 },
    sink: 0.15,
    tints: [new Color3(1, 1, 1), new Color3(1.15, 1.05, 0.8), new Color3(0.85, 0.95, 0.9)],
    tilt: 0.1,
  },
  {
    name: 'rock',
    build: (scene, random) => {
      const stone = new Color3(0.52, 0.49, 0.46)
      const rock = blob(scene, 1, Vector3.Zero(), stone, random, 0.3)
      rock.scaling.set(1.3, 0.7, 1)
      rock.bakeCurrentTransformIntoVertices()
      return rock
    },
    rule: { count: 450, minOffset: 6.2, maxOffset: 140, crowding: 2.4, minScale: 0.25, maxScale: 2.6 },
    sink: 0.25,
    tints: [new Color3(1, 1, 1), new Color3(0.85, 0.83, 0.8), new Color3(1.1, 1.02, 0.92)],
    tilt: 0.35,
  },
  {
    name: 'grass',
    build: (scene, random) => {
      const blades: Mesh[] = []
      for (let index = 0; index < 5; index += 1) {
        const height = between(random, 0.45, 0.85)
        const blade = MeshBuilder.CreateCylinder('blade', { diameterTop: 0, diameterBottom: 0.07, height, tessellation: 3, cap: Mesh.NO_CAP }, scene)
        blade.setPivotPoint(new Vector3(0, -height / 2, 0))
        blade.position.set(between(random, -0.15, 0.15), height / 2, between(random, -0.15, 0.15))
        blade.rotation.set(between(random, -0.45, 0.45), 0, between(random, -0.45, 0.45))
        blades.push(paintMesh(blade, new Color3(0.62, 0.62, 0.28)))
      }
      return merge(blades)
    },
    rule: { count: 4000, minOffset: 5.8, maxOffset: 30, crowding: 1.6, minScale: 0.9, maxScale: 1.8, maxHeightAboveRoad: 25 },
    sink: 0.05,
    tints: [new Color3(1, 1, 1), new Color3(1.2, 1.05, 0.7), new Color3(0.85, 1, 0.85)],
    tilt: 0.15,
  },
  {
    name: 'flowers',
    build: (scene, random) => {
      const parts: Mesh[] = []
      for (let index = 0; index < 4; index += 1) {
        const position = new Vector3(between(random, -0.25, 0.25), between(random, 0.3, 0.5), between(random, -0.25, 0.25))
        const head = MeshBuilder.CreatePolyhedron('head', { type: 1, size: 0.07 }, scene)
        head.position.copyFrom(position)
        parts.push(paintMesh(head, new Color3(1, 1, 1)))
        const stem = MeshBuilder.CreateCylinder('stem', { diameter: 0.025, height: position.y, tessellation: 3, cap: Mesh.NO_CAP }, scene)
        stem.position.set(position.x, position.y / 2, position.z)
        parts.push(paintMesh(stem, new Color3(0.32, 0.42, 0.16)))
      }
      return merge(parts)
    },
    rule: { count: 1600, minOffset: 5.8, maxOffset: 20, crowding: 1.4, minScale: 0.9, maxScale: 1.4, maxHeightAboveRoad: 20, patchiness: 0.25 },
    sink: 0,
    tints: [new Color3(1, 0.82, 0.2), new Color3(0.62, 0.42, 0.88), new Color3(0.97, 0.95, 0.9), new Color3(0.9, 0.3, 0.25)],
    tilt: 0.1,
  },
]

/** Scenery is split into chunks along Z so off-screen chunks are frustum culled. */
const CHUNK_LENGTH = 150

/**
 * Plants trees, bushes, rocks, grass and wildflowers along the road with thin
 * instances: about one draw call per kind and chunk, with no image assets.
 */
export function createVegetation(scene: Scene, area: ScatterArea, seed = 1984): VegetationHandle {
  const root = new TransformNode('vegetation', scene)
  const material = new StandardMaterial('vegetation-material', scene)
  material.specularColor = Color3.Black()
  const random = createRandom(seed)
  const matrix = new Matrix()
  const rotation = new Quaternion()
  const scaling = new Vector3()
  const translation = new Vector3()

  for (const kind of kinds) {
    const prototype = kind.build(scene, random)
    prototype.name = `vegetation-${kind.name}`
    const geometry = VertexData.ExtractFromMesh(prototype)

    const chunks = new Map<number, Placement[]>()
    for (const placement of scatterAlongRoad(random, area, kind.rule)) {
      const chunk = Math.floor(placement.z / CHUNK_LENGTH)
      const placements = chunks.get(chunk)
      if (placements) placements.push(placement)
      else chunks.set(chunk, [placement])
    }

    for (const [chunk, placements] of chunks) {
      // Each chunk gets its own copy of the (small) geometry: chunks sharing one
      // geometry with different thin-instance buffers drew each other's
      // instances after shader recompiles. Copying is also far cheaper than clone().
      const mesh = new Mesh(`${prototype.name}-${chunk}`, scene, root)
      geometry.applyToMesh(mesh)
      mesh.material = material
      mesh.isPickable = false
      const matrices = new Float32Array(placements.length * 16)
      const colors = new Float32Array(placements.length * 4)
      placements.forEach((placement, index) => {
        Quaternion.RotationYawPitchRollToRef(
          placement.yaw,
          between(random, -kind.tilt, kind.tilt),
          between(random, -kind.tilt, kind.tilt),
          rotation,
        )
        scaling.setAll(placement.scale)
        scaling.y *= between(random, 0.85, 1.15)
        translation.set(placement.x, placement.y - kind.sink * placement.scale, placement.z)
        Matrix.ComposeToRef(scaling, rotation, translation, matrix)
        matrix.copyToArray(matrices, index * 16)
        const tint = kind.tints[Math.floor(random() * kind.tints.length)]
        const shade = between(random, 0.88, 1.08)
        colors.set([tint.r * shade, tint.g * shade, tint.b * shade, 1], index * 4)
      })
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, true)
      mesh.thinInstanceSetBuffer('color', colors, 4, true)
      mesh.thinInstanceRefreshBoundingInfo(false)
      mesh.freezeWorldMatrix()
      mesh.doNotSyncBoundingInfo = true
    }
    prototype.dispose()
  }
  material.freeze()

  let disposed = false
  return {
    root,
    dispose: () => {
      if (disposed) return
      disposed = true
      root.dispose()
      material.dispose()
    },
  }
}
