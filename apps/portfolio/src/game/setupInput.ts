import type { BikeController, BikeDirection } from './BikeController'

export interface SetupInputOptions {
  /**
   * Whether ride keys should drive the bike right now. While false, keys keep
   * their normal browser behaviour (for example, scrolling the page).
   */
  isEnabled?: () => boolean
}

export interface BikeInputHandle {
  dispose: () => void
  getDirection: () => BikeDirection
}

const FORWARD_KEYS = new Set(['ArrowUp', 'KeyW'])
const BACKWARD_KEYS = new Set(['ArrowDown', 'KeyS'])
const STOP_KEYS = new Set(['Space', 'KeyX'])
const INTERACTIVE_TARGETS = 'a, button, input, select, textarea, summary, [contenteditable]'

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGETS) !== null
}

/**
 * Maps window keyboard presses to the command API exposed by `BikeController`,
 * so the ride responds without first focusing the canvas.
 */
export function setupInput(
  controller: BikeController,
  { isEnabled = () => true }: SetupInputOptions = {},
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

  const onKeyDown = (event: KeyboardEvent) => {
    const { code } = event
    const isMovementKey = FORWARD_KEYS.has(code) || BACKWARD_KEYS.has(code) || STOP_KEYS.has(code)
    if (!isMovementKey || event.altKey || event.ctrlKey || event.metaKey) return
    if (!isEnabled() || isInteractiveTarget(event.target)) return
    event.preventDefault()

    if (STOP_KEYS.has(code)) {
      pressed.clear()
      // Stop is deliberately global; it is the explicit stop command.
      controller.stop()
    } else {
      pressed.add(code)
      applyDirection()
    }
  }

  // Key releases always apply, so a key held while scrolling away still stops.
  const onKeyUp = (event: KeyboardEvent) => {
    if (pressed.delete(event.code)) applyDirection()
  }

  // A lost window focus does not reliably produce keyup events.
  const releaseAll = () => {
    pressed.clear()
    controller.setInputDirection('keyboard', 0)
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseAll)

  return {
    getDirection: () => controller.getDirection(),
    dispose: () => {
      if (disposed) return
      disposed = true
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      releaseAll()
    },
  }
}
