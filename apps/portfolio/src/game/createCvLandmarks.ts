import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { roadLandmarks, type RoadLandmark } from '../content/portfolio'
import { createRoadSampler, type RoadSampler } from './createRoad'

const BLOOD_RED = '#8b1e24'
const STONE = '#e8e4de'
const BOARD_FONT = 'Inter, ui-sans-serif, system-ui, sans-serif'
const BOARD_WIDTH = 5.6
const BOARD_HEIGHT = 3.15
/** Bottom edge of the board above the road surface. */
const BOARD_CLEARANCE = 1.7
/** Boards turn this far from square-on to face the oncoming rider. */
const BOARD_TOE_IN = 0.45

export interface CreateCvLandmarksOptions {
  landmarks?: readonly RoadLandmark[]
  name?: string
  roadSampler?: RoadSampler
}

export interface CvLandmarksHandle {
  dispose: () => void
  root: TransformNode
}

/**
 * Creates readable, in-world CV billboards on posts beside the road, angled
 * towards the oncoming rider. Their copy comes only from the supplied data.
 */
export function createCvLandmarks(
  scene: Scene,
  {
    landmarks = roadLandmarks,
    name = 'cv-landmarks',
    roadSampler = createRoadSampler(),
  }: CreateCvLandmarksOptions = {},
): CvLandmarksHandle {
  const root = new TransformNode(name, scene)
  const structure = new StandardMaterial(`${name}-structure`, scene)
  structure.diffuseColor = new Color3(0.12, 0.11, 0.1)
  structure.specularColor = new Color3(0.15, 0.15, 0.15)

  for (const landmark of landmarks) {
    const road = roadSampler(landmark.roadPosition.z)
    const landmarkRoot = new TransformNode(`${name}-${landmark.id}`, scene)
    landmarkRoot.parent = root
    landmarkRoot.position.copyFrom(road.center).addInPlace(road.lateral.scale(landmark.roadPosition.x))
    // Babylon planes face local -Z, back towards a rider coming up the road.
    // Toe the board in so a left-side board faces right and vice versa.
    landmarkRoot.rotation.y = road.yaw + Math.sign(landmark.roadPosition.x) * BOARD_TOE_IN

    const boardCentre = BOARD_CLEARANCE + BOARD_HEIGHT / 2
    const board = MeshBuilder.CreatePlane(`${name}-${landmark.id}-board`, { width: BOARD_WIDTH, height: BOARD_HEIGHT }, scene)
    board.parent = landmarkRoot
    board.position.y = boardCentre

    const backing = MeshBuilder.CreateBox(
      `${name}-${landmark.id}-backing`,
      { width: BOARD_WIDTH + 0.2, height: BOARD_HEIGHT + 0.2, depth: 0.12 },
      scene,
    )
    backing.parent = landmarkRoot
    backing.position.set(0, boardCentre, 0.08)
    backing.material = structure
    for (const side of [-1, 1]) {
      // Posts run well below the road so sloping verges never leave them floating.
      const post = MeshBuilder.CreateBox(`${name}-${landmark.id}-post-${side}`, { width: 0.18, height: boardCentre + 1.5, depth: 0.18 }, scene)
      post.parent = landmarkRoot
      post.position.set(side * BOARD_WIDTH * 0.35, (boardCentre - 1.5) / 2, 0.2)
      post.material = structure
    }

    const texture = AdvancedDynamicTexture.CreateForMesh(board, 1024, 576, false)
    const frame = new Rectangle(`${name}-${landmark.id}-frame`)
    frame.thickness = 10
    frame.color = BLOOD_RED
    frame.background = '#0b0b0bf0'
    texture.addControl(frame)

    const title = new TextBlock(`${name}-${landmark.id}-title`, landmark.title)
    title.color = STONE
    title.fontFamily = BOARD_FONT
    title.fontSize = 76
    title.fontWeight = '700'
    title.height = '30%'
    title.paddingTop = '40px'
    title.paddingLeft = '56px'
    title.paddingRight = '56px'
    // Controls default to vertical centring; pin each block to its own edge
    // so the title and detail can never overlap.
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    frame.addControl(title)

    const detail = new TextBlock(`${name}-${landmark.id}-detail`, landmark.board)
    detail.color = STONE
    detail.fontFamily = BOARD_FONT
    detail.fontSize = 42
    detail.lineSpacing = '10px'
    detail.height = '66%'
    detail.paddingBottom = '44px'
    detail.paddingLeft = '56px'
    detail.paddingRight = '56px'
    detail.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    detail.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    detail.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    detail.textWrapping = true
    frame.addControl(detail)
  }

  let disposed = false
  return {
    root,
    dispose: () => {
      if (disposed) return
      disposed = true
      // CreateForMesh owns a material and texture per board. Let hierarchy
      // disposal release both once rather than separately disposing the ADTs.
      root.dispose(false, true)
      structure.dispose()
    },
  }
}
