import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { BikeAsset } from './loadBike'

export type BikeDirection = -1 | 0 | 1

export interface BikeRoute {
  /** Inclusive lower Z coordinate for the bike root. */
  minZ: number
  /** Inclusive upper Z coordinate for the bike root. */
  maxZ: number
}

export interface BikeControllerOptions {
  route: BikeRoute
  /** World units per second. Defaults to 8. */
  speed?: number
}

/**
 * Deterministic command-based route movement. Rendering owns the clock and
 * calls `update` with its delta in seconds; no timers or scene observables are
 * installed by this class.
 */
export class BikeController {
  readonly root: TransformNode
  readonly wheels: readonly TransformNode[]
  readonly route: BikeRoute
  readonly speed: number
  readonly wheelRadius: number
  private direction: BikeDirection = 0
  private readonly inputDirections = new Map<string, BikeDirection>()

  constructor(bike: BikeAsset | TransformNode, { route, speed = 8 }: BikeControllerOptions) {
    if (!Number.isFinite(route.minZ) || !Number.isFinite(route.maxZ) || route.minZ > route.maxZ) {
      throw new RangeError('Bike route must have finite minZ <= maxZ bounds.')
    }
    if (!Number.isFinite(speed) || speed < 0) {
      throw new RangeError('Bike speed must be a finite non-negative number.')
    }

    this.root = 'root' in bike ? bike.root : bike
    this.wheels = 'wheels' in bike ? bike.wheels : []
    this.wheelRadius = 'wheelRadius' in bike ? bike.wheelRadius : 1
    this.route = { ...route }
    this.speed = speed
    this.root.position.z = this.constrain(this.root.position.z)
  }

  advance(): void {
    this.setInputDirection('manual', 1)
  }

  backward(): void {
    this.setInputDirection('manual', -1)
  }

  stop(): void {
    this.inputDirections.clear()
    this.direction = 0
  }

  /**
   * Combines independently-held input sources. Releasing touch, for example,
   * cannot stop a still-held keyboard command. Forward wins if sources disagree.
   */
  setInputDirection(source: string, direction: BikeDirection): void {
    if (!source) throw new RangeError('Input source must be a non-empty string.')
    if (direction === 0) this.inputDirections.delete(source)
    else this.inputDirections.set(source, direction)

    const directions = [...this.inputDirections.values()]
    this.direction = directions.includes(1) ? 1 : directions.includes(-1) ? -1 : 0
  }

  getDirection(): BikeDirection {
    return this.direction
  }

  /** Advances exactly by `speed * deltaSeconds`, clamped to the route. */
  update(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Bike update deltaSeconds must be a finite non-negative number.')
    }

    const requestedDistance = this.direction * this.speed * deltaSeconds
    const previousZ = this.root.position.z
    const nextZ = this.constrain(previousZ + requestedDistance)
    const actualDistance = nextZ - previousZ
    this.root.position.z = nextZ

    if (actualDistance !== 0 && this.wheels.length > 0) {
      // The procedural wheels use a local X axle after their Z-axis orientation.
      const rotation = actualDistance / this.wheelRadius
      for (const wheel of this.wheels) wheel.rotation.x += rotation
    }
    return actualDistance
  }

  private constrain(z: number): number {
    return Math.min(this.route.maxZ, Math.max(this.route.minZ, z))
  }
}
