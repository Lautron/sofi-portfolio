/** Deterministic pseudo-random numbers in [0, 1), so the world looks the same on every visit. */
export type Random = () => number

/** Mulberry32: tiny, fast and good enough for scattering scenery. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform number in [min, max). */
export function between(random: Random, min: number, max: number): number {
  return min + (max - min) * random()
}

function hash2d(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise in [0, 1) on an integer lattice. */
export function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smooth(x - x0)
  const ty = smooth(y - y0)
  const a = hash2d(x0, y0)
  const b = hash2d(x0 + 1, y0)
  const c = hash2d(x0, y0 + 1)
  const d = hash2d(x0 + 1, y0 + 1)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/** Fractal value noise in roughly [0, 1). */
export function fractalNoise(x: number, y: number, octaves = 4): number {
  let sum = 0
  let amplitude = 0.5
  let frequency = 1
  let total = 0
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency + octave * 17.3, y * frequency - octave * 9.1) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / total
}

/** Hermite step from 0 at `edge0` to 1 at `edge1`. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return smooth(t)
}
