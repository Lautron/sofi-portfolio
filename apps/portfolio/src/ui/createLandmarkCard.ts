import type { RoadLandmark, SectionId } from '../content/portfolio'
import { findNearbyLandmark } from './findNearbyLandmark'

export interface LandmarkCardOptions {
  landmarks: readonly RoadLandmark[]
  /** Route distance at which a board's card appears. */
  radius?: number
}

export interface LandmarkCardHandle {
  /** Shows the card for the board nearest the bike's route Z, if any. */
  update: (z: number) => void
  dispose: () => void
}

/**
 * Shows a readable HTML card while the bike passes a road board. The card
 * reuses the page's own rendered section, so links and copy stay identical.
 */
export function createLandmarkCard(
  container: HTMLElement,
  { landmarks, radius = 4.5 }: LandmarkCardOptions,
): LandmarkCardHandle {
  const card = document.createElement('aside')
  card.className = 'landmark-card'
  card.hidden = true
  card.setAttribute('aria-labelledby', 'landmark-card-title')

  const title = document.createElement('h2')
  title.id = 'landmark-card-title'
  const body = document.createElement('div')
  body.className = 'landmark-card-body'
  const more = document.createElement('a')
  more.className = 'landmark-card-more'
  more.textContent = 'Open in the page ↓'
  card.append(title, body, more)

  // Announce only the section change; reading the whole card would be noisy.
  const status = document.createElement('p')
  status.className = 'visually-hidden'
  status.setAttribute('role', 'status')
  container.append(card, status)

  let activeId: SectionId | undefined
  let disposed = false

  return {
    update: (z) => {
      if (disposed) return
      const landmark = findNearbyLandmark(landmarks, z, radius)
      if (landmark?.id === activeId) return
      activeId = landmark?.id

      if (!landmark) {
        card.hidden = true
        status.textContent = ''
        return
      }
      const source = document.querySelector(`.section-body[data-section="${landmark.id}"]`)
      title.textContent = landmark.title
      body.replaceChildren(...(source ? [...source.childNodes].map((node) => node.cloneNode(true)) : []))
      more.href = `#${landmark.id}`
      card.hidden = false
      status.textContent = `Passing ${landmark.title}. Details shown beside the road.`
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      card.remove()
      status.remove()
    },
  }
}
