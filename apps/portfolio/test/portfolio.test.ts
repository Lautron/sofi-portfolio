import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getExternalOrigin } from '../src/config'
import { roadLandmarks } from '../src/content/portfolio'
import { escapeHtml, renderPortfolio } from '../src/content/renderPortfolio'
import { BikeController } from '../src/game/BikeController'
import { findNearbyLandmark } from '../src/ui/findNearbyLandmark'

const at = (z: number) => ({ roadPosition: { z } })

describe('findNearbyLandmark', () => {
  const landmarks = [at(-12), at(0), at(12)]

  it('returns the closest landmark within the radius', () => {
    assert.equal(findNearbyLandmark(landmarks, 1.5, 4.5), landmarks[1])
    assert.equal(findNearbyLandmark(landmarks, -10, 4.5), landmarks[0])
  })

  it('returns undefined between landmarks', () => {
    assert.equal(findNearbyLandmark(landmarks, 6, 4.5), undefined)
  })

  it('keeps the earlier landmark on an exact tie', () => {
    assert.equal(findNearbyLandmark(landmarks, 6, 6), landmarks[1])
  })
})

describe('renderPortfolio', () => {
  it('renders a section body for every road landmark card', () => {
    const html = renderPortfolio()
    for (const { id } of roadLandmarks) {
      assert.match(html, new RegExp(`<section[^>]+id="${id}"`))
      assert.match(html, new RegExp(`data-section="${id}"`))
    }
  })

  it('links only the CVs and blog it is given', () => {
    const bare = renderPortfolio()
    assert.doesNotMatch(bare, /\.pdf/)
    assert.doesNotMatch(bare, />Blog</)

    const linked = renderPortfolio({
      cvLinks: [{ label: 'Game QA CV', href: '/cv/qa.pdf' }],
      blogOrigin: 'https://blog.example.com',
    })
    assert.match(linked, /href="\/cv\/qa\.pdf" download>Game QA CV \(PDF\)</)
    assert.match(linked, /href="https:\/\/blog\.example\.com"/)
  })

  it('escapes interpolated values', () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    const html = renderPortfolio({ cvLinks: [{ label: '<script>', href: '/cv/"x".pdf' }] })
    assert.doesNotMatch(html, /<script>/)
    assert.match(html, /href="\/cv\/&quot;x&quot;\.pdf"/)
  })
})

describe('getExternalOrigin', () => {
  it('accepts bare http(s) origins only', () => {
    assert.equal(getExternalOrigin('https://blog.example.com/'), 'https://blog.example.com')
    assert.equal(getExternalOrigin('https://blog.example.com/posts'), undefined)
    assert.equal(getExternalOrigin('javascript:alert(1)'), undefined)
    assert.equal(getExternalOrigin(undefined), undefined)
  })
})

describe('BikeController', () => {
  const makeBike = (z: number) => ({ position: { z } }) as unknown as ConstructorParameters<typeof BikeController>[0]

  it('moves at its speed and clamps to the route', () => {
    const bike = makeBike(0)
    const controller = new BikeController(bike, { route: { minZ: -1, maxZ: 3 }, speed: 2 })
    controller.setInputDirection('keyboard', 1)
    assert.equal(controller.update(0.5), 1)
    assert.equal(controller.update(5), 2)
    assert.equal(controller.update(1), 0)
  })

  it('lets forward win when input sources disagree, and stop clears all', () => {
    const controller = new BikeController(makeBike(0), { route: { minZ: -5, maxZ: 5 } })
    controller.setInputDirection('touch', -1)
    controller.setInputDirection('keyboard', 1)
    assert.equal(controller.getDirection(), 1)
    controller.setInputDirection('keyboard', 0)
    assert.equal(controller.getDirection(), -1)
    controller.stop()
    assert.equal(controller.getDirection(), 0)
  })
})
