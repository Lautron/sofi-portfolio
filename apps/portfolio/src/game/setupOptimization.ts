import { SceneOptimizer, SceneOptimizerOptions } from '@babylonjs/core/Misc/sceneOptimizer'
import type { Scene } from '@babylonjs/core/scene'

/** Starts the default, conservative Babylon optimization ladder for this scene. */
export function setupOptimization(scene: Scene): () => void {
  const optimizer = new SceneOptimizer(scene, SceneOptimizerOptions.ModerateDegradationAllowed())
  optimizer.start()

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    optimizer.stop()
  }
}
