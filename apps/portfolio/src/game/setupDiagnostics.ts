import type { Scene } from '@babylonjs/core/scene'

export interface DiagnosticsHandle {
  dispose: () => void
}

/** Loads Babylon's development inspector only after an explicit dev request. */
export async function setupDiagnostics(scene: Scene): Promise<DiagnosticsHandle> {
  await import('@babylonjs/inspector')
  await scene.debugLayer.show({ embedMode: true })

  let disposed = false
  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      scene.debugLayer.hide()
    },
  }
}
