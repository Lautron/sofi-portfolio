import { MergeMeshesOptimization, SceneOptimizer, SceneOptimizerOptions } from '@babylonjs/core/Misc/sceneOptimizer'
import type { Scene } from '@babylonjs/core/scene'

/** Starts Babylon's moderate optimization ladder for this scene. */
export function setupOptimization(scene: Scene): () => void {
  const options = SceneOptimizerOptions.ModerateDegradationAllowed()
  // Merging ignores parenting: it would bake the bike's parts into one static
  // mesh left behind at the start while the camera follows the moving root.
  options.optimizations = options.optimizations.filter(
    (optimization) => !(optimization instanceof MergeMeshesOptimization),
  )
  const optimizer = new SceneOptimizer(scene, options)
  optimizer.start()

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    optimizer.stop()
  }
}
