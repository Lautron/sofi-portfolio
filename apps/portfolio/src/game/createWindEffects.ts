import type { Camera } from '@babylonjs/core/Cameras/camera'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import type { Observer } from '@babylonjs/core/Misc/observable'
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
import '@babylonjs/core/Particles/particleSystemComponent'
import type { Scene } from '@babylonjs/core/scene'
import type { BikeAsset } from './loadBike'

export interface WindEffectsOptions {
  camera: Camera
  bike: BikeAsset
  /** Bike speed as a fraction of its top speed, from 0 to 1. */
  getSpeedRatio: () => number
  topSpeed: number
}

export interface WindEffectsHandle {
  dispose: () => void
}

/** Particle ages and velocities are per update step; one step per 60th of a second makes them seconds. */
const SECONDS_PER_STEP = 1 / 60

/**
 * Wind streaks rushing past the camera, scaled with speed so standing still
 * is calm.
 */
export function createWindEffects(
  scene: Scene,
  { camera, bike, getSpeedRatio, topSpeed }: WindEffectsOptions,
): WindEffectsHandle {
  const forward = new Vector3(0, 0, 1)
  let speed = 0

  const streakTexture = new DynamicTexture('wind-streak', { width: 16, height: 128 }, scene, false)
  const context = streakTexture.getContext() as unknown as CanvasRenderingContext2D
  const gradient = context.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = gradient
  context.fillRect(6, 0, 4, 128)
  streakTexture.update()
  streakTexture.hasAlpha = true
  const streaks = new ParticleSystem('wind-streaks', 300, scene)
  streaks.particleTexture = streakTexture
  streaks.emitter = Vector3.Zero()
  streaks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
  streaks.blendMode = ParticleSystem.BLENDMODE_ADD
  streaks.updateSpeed = SECONDS_PER_STEP
  streaks.minLifeTime = 0.25
  streaks.maxLifeTime = 0.5
  streaks.minSize = 0.035
  streaks.maxSize = 0.06
  streaks.minScaleY = 20
  streaks.maxScaleY = 45
  streaks.color1 = new Color4(1, 0.93, 0.82, 0.32)
  streaks.color2 = new Color4(1, 1, 1, 0.2)
  streaks.colorDead = new Color4(1, 1, 1, 0)
  streaks.emitRate = 0
  streaks.startPositionFunction = (_matrix, position) => {
    // A hollow tube ahead of the camera, so streaks frame the bike rather than cover it.
    const angle = Math.random() * Math.PI * 2
    const radius = 1.8 + Math.random() * 5
    const distance = 6 + Math.random() * 26
    const side = new Vector3(forward.z, 0, -forward.x)
    position.copyFrom(camera.globalPosition)
    position.addInPlace(forward.scale(distance))
    position.addInPlace(side.scale(Math.cos(angle) * radius))
    position.y += Math.sin(angle) * radius * 0.6 + 0.5
  }
  streaks.startDirectionFunction = (_matrix, direction) => {
    direction.copyFrom(forward).scaleInPlace(-(6 + speed * topSpeed * 0.8))
  }
  streaks.start()

  const update: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    speed = getSpeedRatio()
    const yaw = bike.root.rotation.y
    forward.set(Math.sin(yaw), 0, Math.cos(yaw))
    streaks.emitRate = Math.max(0, (speed - 0.3) / 0.7) * 160
  })

  let disposed = false
  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      scene.onBeforeRenderObservable.remove(update)
      streaks.dispose()
    },
  }
}
