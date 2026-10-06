import { KeyboardEventTypes, type KeyboardInfo } from '@babylonjs/core/Events/keyboardEvents'
import type { Observer } from '@babylonjs/core/Misc/observable'
import type { Scene } from '@babylonjs/core/scene'
import type { BikeController, BikeDirection } from './BikeController'

export interface SetupInputOptions {
  /** Suppress browser scrolling for the movement keys. Defaults to true. */
  preventDefault?: boolean
}

export interface BikeInputHandle {
  dispose: () => void
  getDirection: () => BikeDirection
}

const FORWARD_KEYS = new Set(['ArrowUp', 'KeyW'])
const BACKWARD_KEYS = new Set(['ArrowDown', 'KeyS'])
const STOP_KEYS = new Set(['Space', 'KeyX'])

/** Maps keyboard presses to the command API exposed by `BikeController`. */
export function setupInput(
  scene: Scene,
  controller: BikeController,
  { preventDefault = true }: SetupInputOptions = {},
): BikeInputHandle {
  const pressed = new Set<string>()
  let disposed = false

  const applyDirection = () => {
    if (pressed.size === 0) {
      controller.setInputDirection('keyboard', 0)
    } else if ([...pressed].some((key) => FORWARD_KEYS.has(key))) {
      controller.setInputDirection('keyboard', 1)
    } else {
      controller.setInputDirection('keyboard', -1)
    }
  }

  const onKeyboard = (info: KeyboardInfo) => {
    const { code } = info.event
    const isMovementKey = FORWARD_KEYS.has(code) || BACKWARD_KEYS.has(code) || STOP_KEYS.has(code)
    if (!isMovementKey) return
    if (preventDefault) info.event.preventDefault()

    if (info.type === KeyboardEventTypes.KEYDOWN) {
      if (STOP_KEYS.has(code)) {
        pressed.clear()
        // Stop is deliberately global; it is the explicit stop command.
        controller.stop()
      } else {
        pressed.add(code)
        applyDirection()
      }
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(code)
      applyDirection()
    }
  }
  const keyboardObserver: Observer<KeyboardInfo> = scene.onKeyboardObservable.add(onKeyboard)

  // A lost window focus does not reliably produce keyup events.
  const releaseAll = () => {
    pressed.clear()
    controller.setInputDirection('keyboard', 0)
  }
  window.addEventListener('blur', releaseAll)

  return {
    getDirection: () => controller.getDirection(),
    dispose: () => {
      if (disposed) return
      disposed = true
      scene.onKeyboardObservable.remove(keyboardObserver)
      window.removeEventListener('blur', releaseAll)
      releaseAll()
    },
  }
}
