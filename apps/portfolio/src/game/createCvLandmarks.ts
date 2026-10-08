import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { cvLandmarks, type CvLandmarkContent } from '../content/cv'
import { createRoadSampler, type RoadSampler } from './createRoad'

export interface CreateCvLandmarksOptions {
  landmarks?: readonly CvLandmarkContent[]
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
    landmarks = cvLandmarks,
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

    const board = MeshBuilder.CreatePlane(`${name}-${landmark.id}-board`, { width: 4.8, height: 2.7 }, scene)
    board.parent = landmarkRoot
    board.position.y = 0.06
    // Babylon planes have a local -Z front normal; +X rotation maps it to +Y.
    // Keeping local +Y toward world +Z preserves the upright GUI orientation.
    board.rotation.x = Math.PI / 2

    const texture = AdvancedDynamicTexture.CreateForMesh(board, 1024, 576, false)
    const frame = new Rectangle(`${name}-${landmark.id}-frame`)
    frame.thickness = 6
    frame.color = '#f4d36b'
    frame.background = '#101820e8'
    texture.addControl(frame)

    const title = new TextBlock(`${name}-${landmark.id}-title`, landmark.title)
    title.color = '#f4d36b'
    title.fontFamily = 'system-ui, sans-serif'
    title.fontSize = 56
    title.fontWeight = '700'
    title.height = '34%'
    title.paddingLeft = '48px'
    title.paddingRight = '48px'
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    frame.addControl(title)

    const detail = new TextBlock(`${name}-${landmark.id}-detail`, landmark.content)
    detail.color = '#e7edf0'
    detail.fontFamily = 'system-ui, sans-serif'
    detail.fontSize = 32
    detail.height = '56%'
    detail.paddingBottom = '36px'
    detail.paddingLeft = '48px'
    detail.paddingRight = '48px'
    detail.resizeToFit = true
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
