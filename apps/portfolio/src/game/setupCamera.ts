import { Camera } from '@babylonjs/core/Cameras/camera'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Observer } from '@babylonjs/core/Misc/observable'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import type { RoadSampler } from './createRoad'

const LANDSCAPE_VERTICAL_FOV = 0.8
/** Phones fix the horizontal field instead, so the road and boards stay in frame. */
const PORTRAIT_HORIZONTAL_FOV = 1.25
/** Extra field of view at top speed: the classic "punching it" widening. */
const SPEED_FOV_KICK = 0.18
const REDUCED_SPEED_FOV_KICK = 0.06
const FOLLOW_DISTANCE = 8.5
const FOLLOW_HEIGHT = 3.3
const LOOK_AHEAD = 8
const MAX_FRAME_SECONDS = 0.1

export interface SetupCameraOptions {
  roadSampler: RoadSampler
  /** Bike speed as a fraction of its top speed, from 0 to 1. */
  getSpeedRatio: () => number
  /** Drops the camera shake and keeps the field of view nearly steady. */
  reducedMotion?: boolean
  /** Camera name in the Babylon scene. */
  name?: string
}

export interface CameraHandle {
  camera: FreeCamera
  dispose: () => void
}

/**
 * A non-interactive chase camera that trails the bike along the road, looking
 * down it to the horizon. It lags a little, pulls back and widens with speed,
 * and shakes slightly near top speed. The scene render loop remains owned by
 * the caller.
 */
export function setupCamera(
  scene: Scene,
  bike: TransformNode,
  { roadSampler, getSpeedRatio, reducedMotion = false, name = 'bike-camera' }: SetupCameraOptions,
): CameraHandle {
  const camera = new FreeCamera(name, Vector3.Zero(), scene)
  camera.minZ = 0.1
  camera.maxZ = 3200
  scene.activeCamera = camera

  // Offsets from the bike are smoothed rather than absolute positions, so the
  // camera never drifts back at a steady speed; it only eases through bends.
  const offset = new Vector3()
  const lookOffset = new Vector3()
  const desiredOffset = new Vector3()
  const desiredLookOffset = new Vector3()
  const lookTarget = new Vector3()
  let speed = 0
  let time = 0
  let initialised = false

  const follow: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    if (bike.isDisposed() || camera.isDisposed()) return
    const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, MAX_FRAME_SECONDS)
    time += seconds
    speed += (getSpeedRatio() - speed) * (1 - Math.exp(-seconds * 3))

    // Tall screens have sky to spare and a card over the bottom; ride higher and
    // look further down so the bike sits nearer the middle.
    const portrait = scene.getEngine().getAspectRatio(camera) < 1
    const bikePosition = bike.getAbsolutePosition()
    const behind = roadSampler(bikePosition.z - FOLLOW_DISTANCE - speed * 0.8)
    const ahead = roadSampler(bikePosition.z + LOOK_AHEAD)
    behind.center.subtractToRef(bikePosition, desiredOffset)
    desiredOffset.y = Math.max(behind.center.y - bikePosition.y, -0.6) + FOLLOW_HEIGHT + speed * 0.35 + (portrait ? 1 : 0)
    ahead.center.subtractToRef(bikePosition, desiredLookOffset)
    desiredLookOffset.y += portrait ? -0.8 : 1.3

    if (!initialised) {
      offset.copyFrom(desiredOffset)
      lookOffset.copyFrom(desiredLookOffset)
      initialised = true
    } else {
      Vector3.LerpToRef(offset, desiredOffset, 1 - Math.exp(-seconds * 4), offset)
      Vector3.LerpToRef(lookOffset, desiredLookOffset, 1 - Math.exp(-seconds * 6), lookOffset)
    }

    bikePosition.addToRef(offset, camera.position)
    bikePosition.addToRef(lookOffset, lookTarget)
    if (!reducedMotion) {
      // Road buzz: tiny, fast, and only near top speed.
      const shake = 0.03 * speed * speed
      camera.position.x += (Math.sin(time * 31) * 0.6 + Math.sin(time * 53) * 0.4) * shake
      camera.position.y += (Math.sin(time * 37) * 0.6 + Math.sin(time * 61) * 0.4) * shake
    }
    camera.setTarget(lookTarget)

    const kick = (reducedMotion ? REDUCED_SPEED_FOV_KICK : SPEED_FOV_KICK) * speed
    camera.fovMode = portrait ? Camera.FOVMODE_HORIZONTAL_FIXED : Camera.FOVMODE_VERTICAL_FIXED
    camera.fov = (portrait ? PORTRAIT_HORIZONTAL_FOV : LANDSCAPE_VERTICAL_FOV) + kick
  })
  let disposed = false

  return {
    camera,
    dispose: () => {
      if (disposed) return
      disposed = true
      scene.onBeforeRenderObservable.remove(follow)
      camera.dispose()
    },
  }
}
