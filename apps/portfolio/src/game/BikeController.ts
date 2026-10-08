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
  /** Top speed in world units per second. Defaults to 8. */
  speed?: number
  /** Units per second squared when speeding up. Defaults to instant. */
  acceleration?: number
  /** Units per second squared when coasting or braking. Defaults to `acceleration`. */
  deceleration?: number
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
  readonly acceleration: number
  readonly deceleration: number
  private direction: BikeDirection = 0
  private velocity = 0
  private readonly inputDirections = new Map<string, BikeDirection>()

  constructor(
    bike: BikeAsset | TransformNode,
    { route, speed = 8, acceleration = Infinity, deceleration = acceleration }: BikeControllerOptions,
  ) {
    if (!Number.isFinite(route.minZ) || !Number.isFinite(route.maxZ) || route.minZ > route.maxZ) {
      throw new RangeError('Bike route must have finite minZ <= maxZ bounds.')
    }
    if (!Number.isFinite(speed) || speed < 0) {
      throw new RangeError('Bike speed must be a finite non-negative number.')
    }
    if (!(acceleration > 0) || !(deceleration > 0)) {
      throw new RangeError('Bike acceleration and deceleration must be positive.')
    }

    this.root = 'root' in bike ? bike.root : bike
    this.wheels = 'wheels' in bike ? bike.wheels : []
    this.wheelRadius = 'wheelRadius' in bike ? bike.wheelRadius : 1
    this.route = { ...route }
    this.speed = speed
    this.acceleration = acceleration
    this.deceleration = deceleration
    this.root.position.z = this.constrain(this.root.position.z)
  }

  advance(): void {
    this.setInputDirection('manual', 1)
  }

  backward(): void {
    this.setInputDirection('manual', -1)
  }

  /** Releases every input; the bike brakes to a halt at its deceleration. */
  stop(): void {
    this.inputDirections.clear()
    this.direction = 0
  }

  /** Stops at once, for when nobody can see the ride. */
  park(): void {
    this.stop()
    this.velocity = 0
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

  /** Signed velocity along the route, in units per second. */
  getVelocity(): number {
    return this.velocity
  }

  /** Current speed as a fraction of top speed, from 0 to 1. */
  getSpeedRatio(): number {
    return this.speed > 0 ? Math.abs(this.velocity) / this.speed : 0
  }

  /**
   * Eases velocity towards the commanded direction, then moves by it,
   * clamped to the route. With the default instant acceleration this advances
   * exactly by `speed * deltaSeconds`.
   */
  update(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Bike update deltaSeconds must be a finite non-negative number.')
    }

    const target = this.direction * this.speed
    const speedingUp = Math.abs(target) > Math.abs(this.velocity) && Math.sign(target) !== -Math.sign(this.velocity)
    const rate = speedingUp ? this.acceleration : this.deceleration
    const maxChange = rate * deltaSeconds
    const change = target - this.velocity
    // Infinity * 0 is NaN, so instant rates skip the easing arithmetic.
    this.velocity = !Number.isFinite(rate) || Math.abs(change) <= maxChange ? target : this.velocity + Math.sign(change) * maxChange

    const previousZ = this.root.position.z
    const nextZ = this.constrain(previousZ + this.velocity * deltaSeconds)
    const actualDistance = nextZ - previousZ
    this.root.position.z = nextZ
    // Hitting either end of the road stops the bike dead.
    if ((nextZ === this.route.maxZ && this.velocity > 0) || (nextZ === this.route.minZ && this.velocity < 0)) {
      this.velocity = 0
    }

    if (actualDistance !== 0 && this.wheels.length > 0) {
      // Wheel nodes spin about their local X axle.
      const rotation = actualDistance / this.wheelRadius
      for (const wheel of this.wheels) wheel.rotation.x += rotation
    }
    return actualDistance
  }

  private constrain(z: number): number {
    return Math.min(this.route.maxZ, Math.max(this.route.minZ, z))
  }
}
