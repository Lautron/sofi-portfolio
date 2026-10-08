import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Observer } from '@babylonjs/core/Misc/observable'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

export interface SetupCameraOptions {
  /** Camera name in the Babylon scene. */
  name?: string
  /** Height above the bike, in world units. */
  height?: number
}

export interface CameraHandle {
  camera: ArcRotateCamera
  dispose: () => void
}

/**
 * Creates a non-interactive oblique camera which keeps the bike centred as it
 * travels. Its slightly right-side angle retains a useful view of the route.
 * The scene render loop remains owned by the caller.
 */
export function setupCamera(
  scene: Scene,
  bike: TransformNode,
  { name = 'bike-camera', height = 20 }: SetupCameraOptions = {},
): CameraHandle {
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('Camera height must be a finite positive number.')
  }

  const target = bike.getAbsolutePosition().clone()
  const obliqueAngle = 0.62
  const rightSideOffset = 0.2
  const camera = new ArcRotateCamera(
    name,
    -Math.PI / 2 + rightSideOffset,
    obliqueAngle,
    height,
    target,
    scene,
  )
  camera.lowerBetaLimit = obliqueAngle
  camera.upperBetaLimit = obliqueAngle
  camera.lowerRadiusLimit = height
  camera.upperRadiusLimit = height
  scene.activeCamera = camera

  const follow: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    if (!bike.isDisposed() && !camera.isDisposed()) camera.setTarget(bike.getAbsolutePosition())
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
