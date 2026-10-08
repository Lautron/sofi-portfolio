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
 * Creates readable, in-world CV signposts. Their copy comes only from the
 * supplied data.
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

  for (const landmark of landmarks) {
    const road = roadSampler(landmark.roadPosition.z)
    const landmarkRoot = new TransformNode(`${name}-${landmark.id}`, scene)
    landmarkRoot.parent = root
    landmarkRoot.position.copyFrom(road.center).addInPlace(road.lateral.scale(landmark.roadPosition.x))
    landmarkRoot.rotation.y = road.yaw

    const board = MeshBuilder.CreatePlane(`${name}-${landmark.id}-board`, { width: 5.6, height: 3.15 }, scene)
    board.parent = landmarkRoot
    board.position.y = 0.06
    // Babylon planes have a local -Z front normal; +X rotation maps it to +Y.
    // Keeping local +Y toward world +Z preserves the upright GUI orientation.
    board.rotation.x = Math.PI / 2

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
    },
  }
}
