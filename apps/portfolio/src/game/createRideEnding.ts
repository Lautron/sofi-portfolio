export type RideEndingPhase = 'riding' | 'leaving' | 'gone' | 'fading'

/**
 * - `leave`: the bike passed the finish; hold the camera and let it ride on.
 * - `fade`: the empty road has been on show long enough; fade the ride out.
 * - `restart`: the fade is done; put the bike back at the start.
 */
export type RideEndingEvent = 'leave' | 'fade' | 'restart'

export interface RideEndingOptions {
  /** Route Z where the camera stops following and the bike rides off on its own. */
  finishZ: number
  /** Route Z by which the bike is out of the camera's sight. */
  goneZ: number
  /** Seconds the empty road stays on screen before the ride fades out. */
  lingerSeconds: number
  /** Seconds the fade takes, matching the CSS transition. */
  fadeSeconds: number
}

export interface RideEnding {
  readonly phase: RideEndingPhase
  /** Advances the sequence; returns the event that starts a new phase, if any. */
  update: (bikeZ: number, deltaSeconds: number) => RideEndingEvent | null
}

/**
 * The end of the ride as a clock-driven sequence: riding, leaving over the
 * horizon, gone, fading back to the start. Rendering owns the clock, so a
 * hidden ride pauses the sequence along with everything else.
 */
export function createRideEnding({ finishZ, goneZ, lingerSeconds, fadeSeconds }: RideEndingOptions): RideEnding {
  if (!(goneZ > finishZ)) throw new RangeError('The bike must be gone beyond the finish.')
  if (!(lingerSeconds >= 0) || !(fadeSeconds >= 0)) throw new RangeError('Ride ending durations must be non-negative.')

  let phase: RideEndingPhase = 'riding'
  let waited = 0

  return {
    get phase() {
      return phase
    },
    update: (bikeZ, deltaSeconds) => {
      switch (phase) {
        case 'riding':
          if (bikeZ < finishZ) return null
          phase = 'leaving'
          return 'leave'
        case 'leaving':
          if (bikeZ < goneZ) return null
          phase = 'gone'
          waited = 0
          return null
        case 'gone':
          waited += deltaSeconds
          if (waited < lingerSeconds) return null
          phase = 'fading'
          waited = 0
          return 'fade'
        case 'fading':
          waited += deltaSeconds
          if (waited < fadeSeconds) return null
          phase = 'riding'
          return 'restart'
      }
    },
  }
}
