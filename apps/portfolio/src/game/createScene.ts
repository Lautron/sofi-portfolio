import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine'
import { Scene, type SceneOptions } from '@babylonjs/core/scene'

/** Creates a Babylon scene without starting a render loop. */
export function createScene(engine: AbstractEngine, options?: SceneOptions): Scene {
  return new Scene(engine, options)
}

/** Releases scene resources when the scene is no longer needed. */
export function disposeScene(scene: Scene): void {
  scene.dispose()
}
