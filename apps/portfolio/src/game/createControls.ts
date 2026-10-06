import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Button } from '@babylonjs/gui/2D/controls/button'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel'
import type { BikeController, BikeDirection } from './BikeController'

export interface ControlsHandle {
  texture: AdvancedDynamicTexture
  dispose: () => void
  getDirection: () => BikeDirection
}

function makeButton(name: string, label: string): Button {
  const button = Button.CreateSimpleButton(name, label)
  button.width = '120px'
  button.height = '56px'
  button.color = '#f8fafc'
  button.background = '#1e293b'
  button.thickness = 1
  button.cornerRadius = 8
  button.paddingBottom = '8px'
  button.isPointerBlocker = true
  return button
}

/** Creates press-and-hold touch controls for the bike command API. */
export function createControls(scene: Scene, controller: BikeController): ControlsHandle {
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('bike-controls', true, scene)
  const stack = new StackPanel('bike-controls-stack')
  stack.width = '120px'
  stack.isVertical = true
  stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  stack.paddingRight = '24px'
  stack.paddingBottom = '24px'

  const advance = makeButton('bike-advance', '▲')
  const stop = makeButton('bike-stop', '■')
  const backward = makeButton('bike-backward', '▼')
  stack.addControl(advance)
  stack.addControl(stop)
  stack.addControl(backward)
  texture.addControl(stack)

  const held = new Set<'advance' | 'backward'>()
  const applyDirection = () => {
    if (held.has('advance')) controller.setInputDirection('touch', 1)
    else if (held.has('backward')) controller.setInputDirection('touch', -1)
    else controller.setInputDirection('touch', 0)
  }
  const hold = (direction: 'advance' | 'backward') => () => {
    held.add(direction)
    applyDirection()
  }
  const release = (direction: 'advance' | 'backward') => () => {
    held.delete(direction)
    applyDirection()
  }

  advance.onPointerDownObservable.add(hold('advance'))
  advance.onPointerUpObservable.add(release('advance'))
  advance.onPointerOutObservable.add(release('advance'))
  backward.onPointerDownObservable.add(hold('backward'))
  backward.onPointerUpObservable.add(release('backward'))
  backward.onPointerOutObservable.add(release('backward'))
  stop.onPointerDownObservable.add(() => {
    held.clear()
    controller.stop()
  })

  let disposed = false
  return {
    texture,
    getDirection: () => controller.getDirection(),
    dispose: () => {
      if (disposed) return
      disposed = true
      held.clear()
      controller.setInputDirection('touch', 0)
      texture.dispose()
    },
  }
}
