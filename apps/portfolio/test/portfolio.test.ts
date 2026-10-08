import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { getExternalOrigin } from '../src/config'
import { roadLandmarks } from '../src/content/portfolio'
import { escapeHtml, renderPortfolio } from '../src/content/renderPortfolio'
import { BikeController } from '../src/game/BikeController'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { createRideEnding } from '../src/game/createRideEnding'
import { loadBike, WHEELBASE } from '../src/game/loadBike'
import { createRoadSampler, roadOffset } from '../src/game/createRoad'
import { setupCamera } from '../src/game/setupCamera'
import { scatterAlongRoad } from '../src/game/createVegetation'
import { createRandom, fractalNoise } from '../src/game/random'
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

  it('eases up to top speed, coasts down after stop, and parks at once', () => {
    const bike = makeBike(0)
    const controller = new BikeController(bike, { route: { minZ: -1000, maxZ: 1000 }, speed: 20, acceleration: 10, deceleration: 20 })
    controller.advance()
    assert.equal(controller.update(0.5), 2.5)
    assert.equal(controller.getVelocity(), 5)
    for (let step = 0; step < 10; step += 1) controller.update(0.5)
    assert.equal(controller.getVelocity(), 20)
    assert.equal(controller.getSpeedRatio(), 1)
    controller.stop()
    controller.update(0.5)
    assert.equal(controller.getVelocity(), 10)
    controller.park()
    assert.equal(controller.getVelocity(), 0)
    assert.equal(controller.update(1), 0)
  })

  it('stops dead at the end of the route', () => {
    const controller = new BikeController(makeBike(9), { route: { minZ: 0, maxZ: 10 }, speed: 20, acceleration: 100 })
    controller.advance()
    controller.update(1)
    assert.equal(controller.getVelocity(), 0)
    controller.backward()
    assert.ok(controller.update(0.1) < 0)
  })
})

describe('createRoadSampler', () => {
  const sample = createRoadSampler(1000)

  it('clamps to the road and returns unit horizontal directions', () => {
    assert.equal(sample(5000).center.z, 500)
    assert.equal(sample(-5000).center.z, -500)
    for (const z of [-400, -123, 0, 77, 380]) {
      const { tangent, lateral } = sample(z)
      assert.ok(Math.abs(tangent.length() - 1) < 1e-9)
      assert.ok(Math.abs(lateral.length() - 1) < 1e-9)
      assert.equal(tangent.y, 0)
      assert.ok(Math.abs(tangent.x * lateral.x + tangent.z * lateral.z) < 1e-9)
    }
  })

  it('is smooth and its curvature matches how the heading turns', () => {
    for (const z of [-300, -40, 150]) {
      const a = sample(z)
      const b = sample(z + 0.5)
      assert.ok(Vector3Distance(a.center, b.center) < 0.6)
      const arc = Math.hypot(b.center.x - a.center.x, b.center.z - a.center.z)
      const turn = b.yaw - a.yaw
      assert.ok(Math.abs(turn / arc - a.curvature) < 1e-3, `curvature at ${z}`)
    }
  })

  it('pitches with the slope of the road, over the crest past the ride too', () => {
    const full = createRoadSampler(1040)
    for (const z of [-300, 150, 360, 400, 445, 480]) {
      const a = full(z)
      const b = full(z + 0.01)
      const run = Math.hypot(b.center.x - a.center.x, b.center.z - a.center.z)
      const pitch = Math.atan((b.center.y - a.center.y) / run)
      assert.ok(Math.abs(pitch - a.pitch) < 1e-3, `pitch at ${z}`)
    }
    // The crest stands well above the road on either side of it.
    assert.ok(full(435).center.y > full(340).center.y + 5)
    assert.ok(full(435).center.y > full(480).center.y + 5)
  })

  it('measures signed offsets across the road', () => {
    const { center, lateral } = sample(42)
    const right = center.add(lateral.scale(5))
    assert.ok(Math.abs(roadOffset(sample, right.x, right.z) - 5) < 0.05)
    const left = center.add(lateral.scale(-3))
    assert.ok(Math.abs(roadOffset(sample, left.x, left.z) + 3) < 0.05)
  })
})

describe('scenery', () => {
  const roadSampler = createRoadSampler(1000)
  const area = {
    roadSampler,
    heightAt: () => 0,
    minZ: -200,
    maxZ: 200,
    clearings: [{ x: 10, z: 0, radius: 8 }],
  }
  const rule = { count: 300, minOffset: 7, maxOffset: 40, crowding: 2, minScale: 1, maxScale: 2 }

  it('is deterministic for a seed', () => {
    assert.deepEqual(scatterAlongRoad(createRandom(5), area, rule), scatterAlongRoad(createRandom(5), area, rule))
    const a = createRandom(1)
    const b = createRandom(1)
    for (let index = 0; index < 5; index += 1) assert.equal(a(), b())
  })

  it('keeps off the road and out of clearings', () => {
    const placements = scatterAlongRoad(createRandom(9), area, rule)
    assert.equal(placements.length, rule.count)
    for (const { x, z } of placements) {
      assert.ok(Math.abs(roadOffset(roadSampler, x, z)) >= rule.minOffset)
      assert.ok(Math.hypot(x - 10, z) >= 8)
    }
  })

  it('makes noise within [0, 1)', () => {
    for (let index = 0; index < 200; index += 1) {
      const value = fractalNoise(index * 0.37 - 20, index * -0.91 + 3)
      assert.ok(value >= 0 && value < 1)
    }
  })
})

function Vector3Distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

describe('createRideEnding', () => {
  const options = { finishZ: 100, goneZ: 150, lingerSeconds: 5, fadeSeconds: 0.5 }

  it('lets the bike ride off at the finish, lingers on the empty road, then restarts', () => {
    const ending = createRideEnding(options)
    assert.equal(ending.update(99, 0.1), null)
    assert.equal(ending.phase, 'riding')
    assert.equal(ending.update(100, 0.1), 'leave')
    assert.equal(ending.update(149, 0.1), null)
    assert.equal(ending.phase, 'leaving')
    assert.equal(ending.update(150, 0.1), null)
    assert.equal(ending.phase, 'gone')
    let event = null
    let seconds = 0
    while (!event) {
      event = ending.update(160, 0.25)
      seconds += 0.25
    }
    assert.equal(event, 'fade')
    assert.equal(seconds, 5)
    assert.equal(ending.update(160, 0.25), null)
    assert.equal(ending.update(160, 0.25), 'restart')
    assert.equal(ending.phase, 'riding')
    assert.equal(ending.update(-50, 0.1), null)
  })

  it('rejects a finish beyond the vanishing point', () => {
    assert.throws(() => createRideEnding({ ...options, goneZ: 100 }), RangeError)
  })
})

describe('setupCamera', () => {
  // Manual renders have no frame time, so smoothing holds the camera's offset
  // from the bike still and any change comes from where it thinks the bike is.
  const setup = () => {
    const engine = new NullEngine()
    const scene = new Scene(engine)
    const bike = new TransformNode('bike', scene)
    // Drawing a part caches the bike's world matrix for the frame, as in the ride.
    CreateBox('part', {}, scene).parent = bike
    const handle = setupCamera(scene, bike, { roadSampler: createRoadSampler(1000), getSpeedRatio: () => 0 })
    scene.render()
    return { engine, scene, bike, handle }
  }

  it('follows the bike in the same frame it moves', () => {
    const { engine, scene, bike, handle } = setup()
    const offset = handle.camera.position.subtract(bike.position)
    bike.position.z += 5
    scene.render()
    assert.ok(Vector3Distance(handle.camera.position.subtract(bike.position), offset) < 1e-9)
    engine.dispose()
  })

  it('holds still while locked and snaps back to the chase when following again', () => {
    const { engine, scene, bike, handle } = setup()
    const held = handle.camera.position.clone()
    handle.lock()
    bike.position.z += 40
    scene.render()
    assert.ok(Vector3Distance(handle.camera.position, held) < 1e-9)
    handle.follow({ snap: true })
    scene.render()
    assert.ok(handle.camera.position.z > held.z + 30)
    engine.dispose()
  })
})

describe('loadBike', () => {
  const load = async () => {
    const engine = new NullEngine()
    const scene = new Scene(engine)
    const model = new Uint8Array(readFileSync(new URL('../src/assets/models/moto.glb', import.meta.url)))
    const bike = await loadBike(scene, model)
    bike.root.computeWorldMatrix(true)
    return { engine, scene, bike }
  }

  it('faces +Z on its tyres, centred between the axles at the ride wheelbase', async () => {
    const { engine, bike } = await load()
    const [front, rear] = bike.wheels.map((wheel) => wheel.getAbsolutePosition())
    assert.ok(front.z > 0 && rear.z < 0)
    assert.ok(Math.abs(front.z - rear.z - WHEELBASE) < 1e-6)
    assert.ok(Math.abs(front.x) < 1e-6 && Math.abs(rear.x) < 1e-6 && Math.abs(front.z + rear.z) < 1e-6)
    const lowestPoint = (wheel: (typeof bike.wheels)[number]) =>
      Math.min(
        ...wheel.getChildMeshes(false).flatMap((mesh) => {
          const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? []
          return Array.from({ length: positions.length / 3 }, (_, index) =>
            Vector3.TransformCoordinatesFromFloatsToRef(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2], mesh.getWorldMatrix(), new Vector3()).y,
          )
        }),
      )
    const lowest = bike.wheels.map(lowestPoint)
    // The model sits a few millimetres off level: the lower tyre is on the road.
    assert.ok(Math.abs(Math.min(...lowest)) < 1e-3, 'a tyre touches the ground')
    assert.ok(lowest.every((y) => y >= -1e-3 && y < 0.01), 'both tyres are on the ground')
    for (const wheel of bike.wheels) {
      const { min, max } = wheel.getHierarchyBoundingVectors(true)
      assert.ok(max.x - min.x < bike.wheelRadius, 'axle runs across the bike')
    }
    engine.dispose()
  })

  it('spins each wheel about its own axle', async () => {
    const { engine, bike } = await load()
    for (const wheel of bike.wheels) {
      wheel.rotation.x = 1.3
      const { min, max } = wheel.getHierarchyBoundingVectors(true)
      assert.ok(Vector3Distance(min.add(max).scale(0.5), wheel.getAbsolutePosition()) < 0.02)
    }
    engine.dispose()
  })

  it('stirs the hair at rest and lifts it back towards horizontal at speed', async () => {
    const { engine, bike } = await load()
    const hair = bike.rider.meshes.find((mesh) => mesh.name.includes('hair')) as (typeof bike.rider.meshes)[number]
    const positions = () => Float32Array.from(hair.getVerticesData(VertexBuffer.PositionKind) ?? [])
    const rest = positions()
    // Mean shift up and along Z, and the largest and smallest shift of any vertex.
    const drift = (to: Float32Array) => {
      let y = 0
      let z = 0
      const shifts: number[] = []
      for (let index = 0; index < rest.length; index += 3) {
        y += to[index + 1] - rest[index + 1]
        z += to[index + 2] - rest[index + 2]
        shifts.push(Math.hypot(to[index] - rest[index], to[index + 1] - rest[index + 1], to[index + 2] - rest[index + 2]))
      }
      return { y: y / shifts.length, z: z / shifts.length, max: Math.max(...shifts), min: Math.min(...shifts) }
    }
    bike.rider.update(0.3, 0)
    const breeze = drift(positions())
    assert.ok(breeze.max > 1e-3 && breeze.max < 0.03, 'a breeze stirs the hair at rest')
    assert.ok(breeze.min < 1e-3, 'the roots stay under the helmet')
    for (let frame = 0; frame < 120; frame += 1) bike.rider.update(1 / 60, 1)
    const wind = drift(positions())
    assert.ok(wind.y > 0.04, 'the hair lifts at speed')
    assert.ok(wind.z < -0.04, 'the hair streams back at speed')
    // A 0.4 m lock swung from hanging to a little above horizontal moves its tip about 0.6 m.
    assert.ok(wind.max < 0.7, 'the locks swing on their roots')
    engine.dispose()
  })

  it('brings only the bike and rider into the scene, and takes them away again', async () => {
    const { engine, scene, bike } = await load()
    assert.equal(scene.lights.length, 0)
    assert.equal(scene.cameras.length, 0)
    assert.ok(bike.meshes.some((mesh) => mesh.name.includes('rider')))
    bike.root.dispose()
    assert.equal(scene.meshes.length, 0)
    assert.equal(scene.materials.length, 0)
    engine.dispose()
  })
})
