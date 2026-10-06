import { Engine } from '@babylonjs/core/Engines/engine'
import type { EngineOptions } from '@babylonjs/core/Engines/thinEngine.pure'

export interface CreateEngineOptions {
  adaptToDeviceRatio?: boolean
  antialias?: boolean
  engineOptions?: EngineOptions
  handleResize?: boolean
}

export interface EngineHandle {
  dispose: () => void
  engine: Engine
}

/**
 * Creates a Babylon engine and, by default, keeps its render size in sync with
 * the browser viewport. Rendering remains the caller's responsibility via
 * `engine.runRenderLoop`.
 */
export function createEngine(
  canvas: HTMLCanvasElement,
  {
    adaptToDeviceRatio = true,
    antialias = true,
    engineOptions,
    handleResize = true,
  }: CreateEngineOptions = {},
): EngineHandle {
  const engine = new Engine(canvas, antialias, engineOptions, adaptToDeviceRatio)
  const resize = () => engine.resize()
  let disposed = false

  if (handleResize) {
    window.addEventListener('resize', resize)
    resize()
  }

  return {
    engine,
    dispose: () => {
      if (disposed) return

      disposed = true
      window.removeEventListener('resize', resize)
      engine.dispose()
    },
  }
}
