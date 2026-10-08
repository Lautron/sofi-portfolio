import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

export interface RiderFit {
  /** Lowest point of the saddle, where the rider sits. */
  seat: Vector3
  /** Right handlebar grip (+X); the left one mirrors it. */
  grip: Vector3
  /** Right footrest (+X); the left one mirrors it. */
  footrest: Vector3
}

export interface RiderOptions extends RiderFit {
  name?: string
}

export interface Rider {
  root: TransformNode
  meshes: readonly Mesh[]
  /** Blows the hair about in the wind of the bike's speed, from 0 to 1 of top speed. */
  update: (seconds: number, speedRatio: number) => void
}

const UP = Vector3.Up()
const UPPER_ARM = 0.42
const FOREARM = 0.46
const THIGH = 0.6
const SHIN = 0.64
/** Half-extents of the head, which the helmet, face and fringe are fitted to. */
const HEAD = new Vector3(0.105, 0.13, 0.12)
/** Hair texture: red strands with fine black ones mixed in, then a deep red band. */
const HAIR_TEXTURE_WIDTH = 256
const HAIR_TEXTURE_HEIGHT = 64
const HAIR_DARK_BAND = 0.875
/** How much of the hair texture's width wraps around one lock. */
const HAIR_LOCK_SPAN = 0.2
/** Hair flutter: a slow breeze at rest, a quick flap at top speed (cycles per second). */
const HAIR_REST_FREQUENCY = 1.4
const HAIR_TOP_FREQUENCY = 7.5
/** How hard a lock's tip flutters off its line at rest and at top speed. */
const HAIR_REST_FLUTTER = 0.07
const HAIR_TOP_FLUTTER = 0.3
/**
 * At top speed each segment of a lock turns this far into the wind, from the
 * root to the tip, so the whole lock lifts off towards horizontal.
 */
const HAIR_ROOT_STREAM = 0.7
const HAIR_TIP_STREAM = 1
/** The wind streams the hair back and this much up, keeping some of its spread. */
const HAIR_WIND_LIFT = 0.3
const HAIR_WIND_SPREAD = 0.5
/** Waves this many radians behind from root to tip, so they run down each lock. */
const HAIR_WAVE_LAG = 3
/** How quickly the hair catches up with a change of speed, per second. */
const HAIR_RESPONSE = 3

interface HairLock {
  /** Rest centreline, with the unit direction and length of each segment along it. */
  path: Vector3[]
  directions: Vector3[]
  lengths: number[]
  /** The lock's first vertex in the merged hair; there is a ring of vertices per path point. */
  first: number
  ringSize: number
  phase: number
  /** Sideways axis the lock flutters along. */
  axis: Vector3
  /** How far the lock gives to the wind, from 0 to 1. */
  stiffness: number
}

/**
 * Where a two-bone limb from `from` to `to` bends, bulging towards `hint`. A
 * target out of reach straightens the limb towards it.
 */
function bendJoint(from: Vector3, to: Vector3, upper: number, lower: number, hint: Vector3): Vector3 {
  const reach = to.subtract(from)
  const distance = Math.min(reach.length(), upper + lower - 1e-3)
  const direction = reach.normalize()
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
  const height = Math.sqrt(Math.max(0, upper * upper - along * along))
  const bulge = hint.subtract(direction.scale(Vector3.Dot(hint, direction))).normalize()
  return from.add(direction.scale(along)).addInPlace(bulge.scaleInPlace(height))
}

/** Deterministic noise in [0, 1), so the rider looks the same on every load. */
function random(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

/**
 * Hair strands run down the texture (V follows a tube's length). Most are
 * shades of red with hairline black ones in between; the last band is a deep
 * red for the darker locks, and every strand darkens towards the root.
 */
function createHairTexture(name: string, scene: Scene): RawTexture {
  const width = HAIR_TEXTURE_WIDTH
  const height = HAIR_TEXTURE_HEIGHT
  const next = random(23)
  const strands: number[][] = []
  for (let x = 0; x < width; ) {
    const deep = x >= width * HAIR_DARK_BAND
    if (next() < (deep ? 0.25 : 0.15)) {
      strands[x] = [14 + next() * 20, 4 + next() * 6, 6 + next() * 8]
      x += 1
      continue
    }
    const color = deep ? [62 + next() * 40, 4 + next() * 8, 10 + next() * 10] : [120 + next() * 110, 6 + next() * 22, 16 + next() * 24]
    for (let strand = 1 + Math.floor(next() * 3); strand > 0 && x < width; strand -= 1, x += 1) strands[x] = color
  }
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const root = 0.72 + 0.28 * Math.min(1, y / (height * 0.25))
    for (let x = 0; x < width; x += 1) {
      const shade = root * (0.88 + next() * 0.24)
      const offset = (y * width + x) * 4
      for (let channel = 0; channel < 3; channel += 1) data[offset + channel] = Math.min(255, strands[x][channel] * shade)
      data[offset + 3] = 255
    }
  }
  return RawTexture.CreateRGBATexture(data, width, height, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE)
}

/**
 * A rider with red hair under an open-face helmet, in a black leather jacket,
 * jeans and high boots, authored facing local +Z and fitted to the bike's seat,
 * grips and footrests. Parts are merged per material to keep draw calls low.
 */
export function createRider(scene: Scene, { name = 'rider', seat, grip, footrest }: RiderOptions): Rider {
  const root = new TransformNode(name, scene)

  const material = (part: string, diffuse: Color3, specular: number, power: number): StandardMaterial => {
    const result = new StandardMaterial(`${name}-${part}`, scene)
    result.diffuseColor = diffuse
    result.specularColor = new Color3(specular, specular, specular)
    result.specularPower = power
    return result
  }
  const jacket = material('jacket', new Color3(0.055, 0.055, 0.065), 0.18, 24)
  const denim = material('denim', new Color3(0.13, 0.16, 0.24), 0.05, 8)
  const helmet = material('helmet', new Color3(0.07, 0.07, 0.08), 0.9, 128)
  const black = material('black', new Color3(0.05, 0.05, 0.06), 0.6, 64)
  const boots = material('boots', new Color3(0.03, 0.03, 0.035), 0.75, 90)
  const skin = material('skin', new Color3(0.95, 0.82, 0.76), 0.15, 16)
  const lipstick = material('lipstick', new Color3(0.42, 0.03, 0.08), 0.5, 48)
  const hairTexture = createHairTexture(`${name}-hair`, scene)
  const hair = material('hair', Color3.White(), 0.25, 32)
  hair.diffuseTexture = hairTexture
  const materials = [jacket, denim, helmet, black, boots, skin, lipstick, hair]

  const parts = new Map<StandardMaterial, Mesh[]>()
  const add = (mesh: Mesh, partMaterial: StandardMaterial): Mesh => {
    parts.set(partMaterial, [...(parts.get(partMaterial) ?? []), mesh])
    return mesh
  }
  const tube = (from: Vector3, to: Vector3, radius: number, partMaterial: StandardMaterial, toRadius = radius): Mesh => {
    const direction = to.subtract(from)
    const mesh = MeshBuilder.CreateCylinder(
      'part',
      { height: direction.length(), diameterBottom: radius * 2, diameterTop: toRadius * 2, tessellation: 10 },
      scene,
    )
    mesh.position.copyFrom(from.add(to).scaleInPlace(0.5))
    mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(UP, direction.normalize(), new Quaternion())
    return add(mesh, partMaterial)
  }
  const ellipsoid = (position: Vector3, size: Vector3, partMaterial: StandardMaterial, tiltX = 0): Mesh => {
    const mesh = MeshBuilder.CreateSphere('part', { segments: 12, diameterX: size.x, diameterY: size.y, diameterZ: size.z }, scene)
    mesh.position.copyFrom(position)
    mesh.rotation.x = tiltX
    return add(mesh, partMaterial)
  }
  const box = (position: Vector3, size: Vector3, partMaterial: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateBox('part', { width: size.x, height: size.y, depth: size.z }, scene)
    mesh.position.copyFrom(position)
    return add(mesh, partMaterial)
  }
  // The locks in the order they are merged, to bend them in the wind.
  const locks: HairLock[] = []
  let hairVertices = 0
  const swayRandom = random(57)
  // A lock of hair tapering from root to a point, wrapped in a slice of the
  // hair texture that starts at `shade` across its width. It flutters along
  // `axis` and gives to the wind as far as `stiffness` lets it.
  const lock = (path: Vector3[], radius: number, shade: number, axis: Vector3, stiffness = 1): Mesh => {
    const last = path.length - 1
    const mesh = MeshBuilder.CreateTube(
      'part',
      {
        path,
        tessellation: 8,
        radiusFunction: (index) => radius * Math.pow(Math.sin(Math.PI * (0.15 + (0.85 * index) / last)), 0.6),
      },
      scene,
    )
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind) ?? []
    for (let index = 0; index < uvs.length; index += 2) uvs[index] = shade + uvs[index] * HAIR_LOCK_SPAN
    mesh.setVerticesData(VertexBuffer.UVKind, uvs)
    const directions = path.slice(1).map((point, index) => point.subtract(path[index]))
    const lengths = directions.map((direction) => direction.length())
    for (const direction of directions) direction.normalize()
    const vertices = mesh.getTotalVertices()
    locks.push({
      path,
      directions,
      lengths,
      first: hairVertices,
      ringSize: vertices / path.length,
      phase: swayRandom() * Math.PI * 2,
      axis,
      stiffness,
    })
    hairVertices += vertices
    return add(mesh, hair)
  }
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const mirror = (point: Vector3, side: number) => v(point.x * side, point.y, point.z)

  // Torso, sitting upright with a slight lean towards the bars: a narrow
  // waist between rounded hips and chest, under slim shoulders.
  const hips = seat.add(v(0, 0.1, 0))
  ellipsoid(hips, v(0.42, 0.25, 0.33), denim)
  ellipsoid(hips.add(v(0, 0.19, 0.07)), v(0.3, 0.3, 0.24), jacket, 0.32)
  ellipsoid(hips.add(v(0, 0.35, 0.16)), v(0.37, 0.32, 0.27), jacket, 0.32)
  for (const side of [-1, 1]) ellipsoid(hips.add(v(side * 0.068, 0.34, 0.235)), v(0.13, 0.11, 0.1), jacket, 0.32)
  ellipsoid(hips.add(v(0, 0.47, 0.23)), v(0.42, 0.16, 0.24), jacket, 0.2)
  tube(hips.add(v(0, 0.5, 0.25)), hips.add(v(0, 0.64, 0.3)), 0.045, skin)

  // Head with a face left open by the helmet: winged eyes and dark lips.
  const head = hips.add(v(0, 0.72, 0.31))
  const onFace = (x: number, y: number, lift: number) => {
    const depth = Math.sqrt(Math.max(0, 1 - (x / HEAD.x) ** 2 - (y / HEAD.y) ** 2))
    return head.add(v(x, y, depth * HEAD.z + lift))
  }
  ellipsoid(head, HEAD.scale(2), skin)
  ellipsoid(onFace(0, -0.025, -0.008), v(0.026, 0.04, 0.03), skin)
  for (const side of [-1, 1]) ellipsoid(onFace(side * 0.045, 0.012, -0.006), v(0.042, 0.018, 0.02), black, 0)
  ellipsoid(onFace(0, -0.07, -0.004), v(0.05, 0.018, 0.02), lipstick)

  // Open-face helmet: a shell tipped back so it covers the crown, ears and
  // nape, with a short peak over the brow and a strap under the chin.
  const shell = MeshBuilder.CreateSphere(
    'part',
    { segments: 16, diameterX: 0.28, diameterY: 0.29, diameterZ: 0.3, slice: 0.56, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  )
  shell.position.copyFrom(head.add(v(0, 0.012, -0.012)))
  shell.rotation.x = -0.7
  add(shell, helmet)
  ellipsoid(head.add(v(0, 0.085, 0.15)), v(0.2, 0.025, 0.09), helmet, -0.15)
  for (const side of [-1, 1]) tube(head.add(v(side * 0.11, -0.03, 0)), head.add(v(0, -0.125, 0.05)), 0.008, black)

  // Medium-length hair falls from under the helmet in separate locks, swept
  // back by the wind, with a few loose strands and a side-swept fringe.
  const next = random(41)
  const strand = (angle: number, length: number, radius: number, sweep: number, wave: number, shade: number, lift = 1) => {
    const outward = v(Math.sin(angle), 0, -Math.cos(angle))
    const across = v(Math.cos(angle), 0, Math.sin(angle))
    const start = head.add(outward.scale(0.115 - 0.01 * (1 - lift))).addInPlace(v(0, -0.025 - 0.05 * Math.cos(angle), 0))
    const phase = next() * Math.PI * 2
    const path: Vector3[] = []
    for (let step = 0; step <= 9; step += 1) {
      const t = step / 9
      const away = lift * Math.sin((Math.min(1, t * 1.8) * Math.PI) / 2)
      path.push(
        start
          .add(v(Math.sin(angle) * 0.08 * away, -length * t, -Math.max(0, Math.cos(angle)) * 0.07 * away - sweep * t))
          .addInPlace(across.scale(wave * t * Math.sin(t * Math.PI * 2.4 + phase))),
      )
    }
    // The inner layer, sheltered by the outer locks, gives a little less to the wind.
    lock(path, radius, shade, across, 0.5 + 0.5 * lift)
  }
  const shadeFor = (dark: boolean) => (dark ? HAIR_DARK_BAND : next() * (HAIR_DARK_BAND - HAIR_LOCK_SPAN))
  const LOCKS = 24
  for (let index = 0; index < LOCKS; index += 1) {
    const angle = ((index / (LOCKS - 1)) * 2 - 1) * 2.3 + (next() - 0.5) * 0.12
    const length = (0.34 - (0.1 * Math.abs(angle)) / Math.PI) * (0.82 + next() * 0.32)
    // Deep red locks stay off the middle of the back, where the jacket shows.
    const dark = next() < 0.3 && Math.abs(angle) > 0.7
    strand(angle, length, 0.034 + next() * 0.016, 0.12 * (length / 0.34), 0.02, shadeFor(dark))
  }
  // An inner layer closer to the neck fills the gaps between the outer locks.
  for (let index = 0; index < 9; index += 1) {
    const angle = ((index / 8) * 2 - 1) * 1.4
    strand(angle, 0.3 + next() * 0.04, 0.05, 0.1, 0.01, shadeFor(false), 0.45)
  }
  for (let index = 0; index < 7; index += 1) {
    strand((next() * 2 - 1) * 1.9, 0.3 + next() * 0.12, 0.011 + next() * 0.006, 0.2, 0.04, shadeFor(next() < 0.3))
  }
  for (let index = 0; index < 4; index += 1) {
    const x = -0.07 + index * 0.035
    const path: Vector3[] = []
    for (let step = 0; step <= 6; step += 1) {
      const t = step / 6
      path.push(onFace(x + 0.05 * t, 0.085 - 0.05 * t - 0.012 * index * t, 0.012))
    }
    // The fringe lies on the brow, so it barely stirs.
    lock(path, 0.02, shadeFor(index === 2), Vector3.Right(), 0.1)
  }

  for (const side of [-1, 1]) {
    // Arms reach the grips with the elbows bent down and out.
    const shoulder = hips.add(v(side * 0.2, 0.46, 0.27))
    const hand = mirror(grip, side)
    const elbow = bendJoint(shoulder, hand, UPPER_ARM, FOREARM, v(side * 0.6, -1, -0.3))
    ellipsoid(shoulder, v(0.13, 0.13, 0.13), jacket)
    tube(shoulder, elbow, 0.058, jacket, 0.05)
    tube(elbow, hand, 0.05, jacket, 0.045)
    ellipsoid(hand, v(0.095, 0.09, 0.115), black)

    // Legs run forward to the footrests with the knees up, into black boots
    // that reach just under the knee.
    const hip = hips.add(v(side * 0.135, -0.02, 0.04))
    const foot = mirror(footrest, side)
    const knee = bendJoint(hip, foot, THIGH, SHIN, v(side * 0.3, 1, 0))
    const bootTop = Vector3.Lerp(knee, foot, 0.14)
    tube(hip, knee, 0.085, denim, 0.065)
    tube(knee, bootTop, 0.062, denim)
    tube(bootTop, Vector3.Lerp(knee, foot, 0.2), 0.076, boots)
    tube(Vector3.Lerp(knee, foot, 0.2), foot, 0.07, boots, 0.058)
    ellipsoid(foot.add(v(0, -0.015, 0.07)), v(0.11, 0.1, 0.25), boots)
    box(foot.add(v(0, -0.07, 0.07)), v(0.12, 0.04, 0.27), boots)
    box(foot.add(v(0, -0.09, -0.035)), v(0.09, 0.07, 0.07), boots)
  }

  const meshes: Mesh[] = []
  let hairMesh: Mesh | undefined
  for (const [partMaterial, group] of parts) {
    const merged = Mesh.MergeMeshes(group, true, true) as Mesh
    merged.name = `${partMaterial.name}-parts`
    merged.material = partMaterial
    merged.parent = root
    merged.isPickable = false
    meshes.push(merged)
    if (partMaterial === hair) hairMesh = merged
  }

  // The hair is bent from its rest pose every frame: each lock's centreline
  // turns into the wind segment by segment, and carries its rings of vertices
  // and their normals round with it. Its tips stray past the merged bounds, so
  // never cull it on them.
  const hairParts = hairMesh as Mesh
  const positions = Float32Array.from(hairParts.getVerticesData(VertexBuffer.PositionKind) ?? [])
  const restNormals = Float32Array.from(hairParts.getVerticesData(VertexBuffer.NormalKind) ?? [])
  const normals = Float32Array.from(restNormals)
  // Each vertex from the centre of its ring.
  const offsets = Float32Array.from(positions)
  for (const { path, first, ringSize } of locks) {
    for (let vertex = 0; vertex < path.length * ringSize; vertex += 1) {
      const centre = path[Math.floor(vertex / ringSize)]
      const index = (first + vertex) * 3
      offsets[index] -= centre.x
      offsets[index + 1] -= centre.y
      offsets[index + 2] -= centre.z
    }
  }
  hairParts.setVerticesData(VertexBuffer.PositionKind, positions, true)
  hairParts.setVerticesData(VertexBuffer.NormalKind, normals, true)
  hairParts.alwaysSelectAsActiveMesh = true

  const longest = Math.max(...locks.map(({ path }) => path.length))
  const bent = Array.from({ length: longest }, () => new Vector3())
  const bentDirections = Array.from({ length: longest }, () => new Vector3())
  const restTangent = new Vector3()
  const tangent = new Vector3()
  const toward = new Vector3()
  const turned = new Vector3()
  const turn = new Quaternion()
  let qx = 0
  let qy = 0
  let qz = 0
  let qw = 1
  // Rotates the vector at `index` in `from` by the current ring's turn and
  // writes it, moved by (x, y, z), to `to`. In plain numbers, as there are
  // thousands of these a frame.
  const rotate = (from: Float32Array, to: Float32Array, index: number, x: number, y: number, z: number) => {
    const vx = from[index]
    const vy = from[index + 1]
    const vz = from[index + 2]
    const tx = 2 * (qy * vz - qz * vy)
    const ty = 2 * (qz * vx - qx * vz)
    const tz = 2 * (qx * vy - qy * vx)
    to[index] = x + vx + qw * tx + qy * tz - qz * ty
    to[index + 1] = y + vy + qw * ty + qz * tx - qx * tz
    to[index + 2] = z + vz + qw * tz + qx * ty - qy * tx
  }
  let wind = 0
  let wave = 0
  const update = (seconds: number, speedRatio: number) => {
    wind += (Math.min(1, Math.max(0, speedRatio)) - wind) * (1 - Math.exp(-seconds * HAIR_RESPONSE))
    // Advance the wave rather than scale the clock, so speeding up never jumps it.
    wave += seconds * Math.PI * 2 * (HAIR_REST_FREQUENCY + (HAIR_TOP_FREQUENCY - HAIR_REST_FREQUENCY) * wind)
    const flutter = HAIR_REST_FLUTTER + (HAIR_TOP_FLUTTER - HAIR_REST_FLUTTER) * wind
    for (const { path, directions, lengths, first, ringSize, phase, axis, stiffness } of locks) {
      const last = path.length - 1
      bent[0].copyFrom(path[0])
      for (let segment = 0; segment < last; segment += 1) {
        const along = (segment + 1) / last
        const rest = directions[segment]
        // Wind from ahead streams the lock back (-Z) and lifts it, more so
        // towards the tip, while a wave runs down it.
        toward.set(rest.x * HAIR_WIND_SPREAD, HAIR_WIND_LIFT, -1).normalize()
        const give = stiffness * wind * (HAIR_ROOT_STREAM + (HAIR_TIP_STREAM - HAIR_ROOT_STREAM) * along)
        const wiggle = stiffness * along * flutter
        const wavePhase = wave + phase - along * HAIR_WAVE_LAG
        const side = Math.sin(wavePhase) * wiggle
        const direction = Vector3.LerpToRef(rest, toward, give, bentDirections[segment])
        direction.addInPlaceFromFloats(axis.x * side, 0.6 * wiggle * Math.sin(wavePhase * 1.3 + 1), axis.z * side).normalize()
        bent[segment].addToRef(direction.scaleToRef(lengths[segment], turned), bent[segment + 1])
      }
      for (let ring = 0; ring <= last; ring += 1) {
        // A ring turns as the centreline did through it, between the segments either side.
        const before = Math.max(0, ring - 1)
        const after = Math.min(last - 1, ring)
        directions[before].addToRef(directions[after], restTangent).normalize()
        bentDirections[before].addToRef(bentDirections[after], tangent).normalize()
        Quaternion.FromUnitVectorsToRef(restTangent, tangent, turn)
        const { x: centreX, y: centreY, z: centreZ } = bent[ring]
        ;({ x: qx, y: qy, z: qz, w: qw } = turn)
        for (let vertex = first + ring * ringSize, end = vertex + ringSize; vertex < end; vertex += 1) {
          rotate(offsets, positions, vertex * 3, centreX, centreY, centreZ)
          rotate(restNormals, normals, vertex * 3, 0, 0, 0)
        }
      }
    }
    hairParts.updateVerticesData(VertexBuffer.PositionKind, positions)
    hairParts.updateVerticesData(VertexBuffer.NormalKind, normals)
  }

  root.onDisposeObservable.addOnce(() => {
    for (const partMaterial of materials) partMaterial.dispose()
    hairTexture.dispose()
  })

  return { root, meshes, update }
}
