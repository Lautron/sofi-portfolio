import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import type { Scene } from '@babylonjs/core/scene'
import type { RoadSampler } from './createRoad'
import { fractalNoise, smoothstep } from './random'

export interface CreateTerrainOptions {
  roadSampler: RoadSampler
  /** Half extent along Z; keep it beyond the road ends so they fade into haze. */
  halfLength?: number
  /** Half extent across X. */
  halfWidth?: number
  name?: string
}

export interface TerrainHandle {
  mesh: Mesh
  /** Ground height used by the mesh at its vertices; use it to plant scenery. */
  heightAt: (x: number, z: number) => number
  dispose: () => void
}

/** Ground sits this far below the road centreline next to the asphalt. */
const ROAD_CLEARANCE = 0.35
/** Flat verge width either side of the road centreline. */
const VERGE = 7.5
const ROW_SPACING = 3
const NEAR_COLUMN_SPACING = 2.5
const NEAR_BAND = 70
const FAR_COLUMN_GROWTH = 1.08

const meadow = new Color3(0.33, 0.42, 0.18)
const dryGrass = new Color3(0.55, 0.5, 0.25)
const verge = new Color3(0.46, 0.42, 0.28)
const rock = new Color3(0.42, 0.38, 0.36)
const snow = new Color3(0.94, 0.93, 0.95)

/**
 * Builds the height function: a flat verge hugging the road, rolling hills
 * beyond it and ridged mountains far out on both sides.
 */
export function createHeightField(roadSampler: RoadSampler) {
  // Terrain rows and scatter queries repeat the same Z, so reuse the last sample.
  let cachedZ = Number.NaN
  let cached = roadSampler(0)
  return (x: number, z: number) => {
    if (z !== cachedZ) {
      cachedZ = z
      cached = roadSampler(z)
    }
    const base = cached.center.y - ROAD_CLEARANCE
    const distance = Math.abs((x - cached.center.x) * cached.tangent.z)
    const hills = (fractalNoise(x / 70, z / 70) - 0.3) * 26 * smoothstep(VERGE, 45, distance)
    const ridge = 1 - Math.abs(2 * fractalNoise(x / 130 + 40, z / 130, 5) - 1)
    const mountains = ridge * ridge * 140 * smoothstep(80, 260, distance)
    return base + hills + mountains
  }
}

/** Column positions: dense near the winding road, coarser towards the mountains. */
function columnPositions(halfWidth: number): number[] {
  const right: number[] = []
  for (let x = 0; x <= NEAR_BAND; x += NEAR_COLUMN_SPACING) right.push(x)
  let step = NEAR_COLUMN_SPACING
  let x = right[right.length - 1]
  while (x < halfWidth) {
    step *= FAR_COLUMN_GROWTH
    x = Math.min(halfWidth, x + step)
    right.push(x)
  }
  return [...right.slice(1).reverse().map((value) => -value), ...right]
}

/** Creates a single vertex-coloured terrain mesh around the road. */
export function createTerrain(
  scene: Scene,
  { roadSampler, halfLength = 600, halfWidth = 340, name = 'terrain' }: CreateTerrainOptions,
): TerrainHandle {
  const heightAt = createHeightField(roadSampler)
  const xs = columnPositions(halfWidth)
  const rows = Math.ceil((halfLength * 2) / ROW_SPACING)
  const columns = xs.length

  const positions = new Float32Array((rows + 1) * columns * 3)
  const relativeHeights = new Float32Array((rows + 1) * columns)
  const offsets = new Float32Array((rows + 1) * columns)
  for (let row = 0; row <= rows; row += 1) {
    const z = -halfLength + row * ROW_SPACING
    const road = roadSampler(z)
    for (let column = 0; column < columns; column += 1) {
      const x = xs[column]
      const y = heightAt(x, z)
      const index = row * columns + column
      positions[index * 3] = x
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = z
      relativeHeights[index] = y - road.center.y
      offsets[index] = Math.abs((x - road.center.x) * road.tangent.z)
    }
  }

  const indices: number[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      indices.push(a, b, c, b, d, c)
    }
  }

  const normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  // Make the winding face up whatever the handedness convention.
  if (normals[1] < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1]
      indices[index + 1] = indices[index + 2]
      indices[index + 2] = swap
    }
    normals.length = 0
    VertexData.ComputeNormals(positions, indices, normals)
  }

  const colors = new Float32Array((rows + 1) * columns * 4)
  const color = new Color3()
  for (let index = 0; index < relativeHeights.length; index += 1) {
    const x = positions[index * 3]
    const z = positions[index * 3 + 2]
    const steepness = 1 - normals[index * 3 + 1]
    Color3.LerpToRef(meadow, dryGrass, smoothstep(0.35, 0.75, fractalNoise(x / 40, z / 40, 3)), color)
    Color3.LerpToRef(color, verge, 1 - smoothstep(4, VERGE + 2, offsets[index]), color)
    Color3.LerpToRef(color, rock, Math.max(smoothstep(0.22, 0.45, steepness), smoothstep(30, 55, relativeHeights[index])), color)
    Color3.LerpToRef(color, snow, smoothstep(85, 105, relativeHeights[index]), color)
    colors.set([color.r, color.g, color.b, 1], index * 4)
  }

  const mesh = new Mesh(name, scene)
  const vertexData = new VertexData()
  vertexData.positions = positions
  vertexData.indices = indices
  vertexData.normals = normals
  vertexData.colors = colors
  vertexData.applyToMesh(mesh)

  const material = new StandardMaterial(`${name}-material`, scene)
  material.specularColor = Color3.Black()
  mesh.material = material
  mesh.receiveShadows = true
  mesh.isPickable = false
  mesh.freezeWorldMatrix()

  let disposed = false
  return {
    mesh,
    heightAt,
    dispose: () => {
      if (disposed) return
      disposed = true
      mesh.dispose()
      material.dispose()
    },
  }
}
