import type { BikeController, BikeDirection } from './BikeController'

export interface ControlsHandle {
  element: HTMLElement
  dispose: () => void
  getDirection: () => BikeDirection
}

type HeldDirection = 'advance' | 'backward'

function makeButton(label: string, symbol: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ride-button'
  button.setAttribute('aria-label', label)
  button.textContent = symbol
  return button
}

/**
 * Creates accessible ride controls. Pointer input is press-and-hold; keyboard
 * activation (Enter/Space on a focused button) starts continuous movement that
 * the stop button ends.
 */
export function createControls(container: HTMLElement, controller: BikeController): ControlsHandle {
  const element = document.createElement('div')
  element.className = 'ride-controls'
  element.setAttribute('role', 'group')
  element.setAttribute('aria-label', 'Motorcycle controls')

  const advance = makeButton('Ride forward', '▲')
  const stop = makeButton('Stop', '■')
  const backward = makeButton('Ride backward', '▼')
  element.append(advance, stop, backward)
  container.append(element)

  const held = new Set<HeldDirection>()
  const applyDirection = () => {
    if (held.has('advance')) controller.setInputDirection('touch', 1)
    else if (held.has('backward')) controller.setInputDirection('touch', -1)
    else controller.setInputDirection('touch', 0)
  }

  const abort = new AbortController()
  const { signal } = abort
  const bindHold = (button: HTMLButtonElement, direction: HeldDirection) => {
    button.addEventListener(
      'pointerdown',
      (event) => {
        // Keep focus off the button: a focused button would swallow ride keys
        // and turn Space ("stop") into a keyboard click that starts riding.
        event.preventDefault()
        button.setPointerCapture(event.pointerId)
        held.add(direction)
        applyDirection()
      },
      { signal },
    )
    const release = () => {
      held.delete(direction)
      applyDirection()
    }
    button.addEventListener('pointerup', release, { signal })
    button.addEventListener('pointercancel', release, { signal })
    button.addEventListener('lostpointercapture', release, { signal })
    // `detail === 0` identifies keyboard activation; pointer clicks already held.
    button.addEventListener(
      'click',
      (event) => {
        if (event.detail !== 0) return
        if (direction === 'advance') controller.advance()
        else controller.backward()
      },
      { signal },
    )
  }
  bindHold(advance, 'advance')
  bindHold(backward, 'backward')
  stop.addEventListener(
    'click',
    () => {
      held.clear()
      controller.stop()
    },
    { signal },
  )
  // Long-presses on touch screens otherwise open the context menu.
  element.addEventListener('contextmenu', (event) => event.preventDefault(), { signal })

  let disposed = false
  return {
    element,
    getDirection: () => controller.getDirection(),
    dispose: () => {
      if (disposed) return
      disposed = true
      abort.abort()
      held.clear()
      controller.setInputDirection('touch', 0)
      element.remove()
    },
  }
}
