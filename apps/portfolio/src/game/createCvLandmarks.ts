import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { cvLandmarks, type CvLandmarkContent } from '../content/cv'

export interface CreateCvLandmarksOptions {
  landmarks?: readonly CvLandmarkContent[]
  name?: string
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
  { landmarks = cvLandmarks, name = 'cv-landmarks' }: CreateCvLandmarksOptions = {},
): CvLandmarksHandle {
  const root = new TransformNode(name, scene)
  const boardMaterial = new StandardMaterial(`${name}-board-material`, scene)
  boardMaterial.diffuseColor = new Color3(0.06, 0.1, 0.12)
  // A board can be approached from either direction along the road.
  boardMaterial.backFaceCulling = false
  const postMaterial = new StandardMaterial(`${name}-post-material`, scene)
  postMaterial.diffuseColor = new Color3(0.2, 0.25, 0.24)
  const textures: AdvancedDynamicTexture[] = []

  for (const landmark of landmarks) {
    const landmarkRoot = new TransformNode(`${name}-${landmark.id}`, scene)
    landmarkRoot.parent = root
    landmarkRoot.position.set(landmark.roadPosition.x, 0, landmark.roadPosition.z)

    const board = MeshBuilder.CreatePlane(`${name}-${landmark.id}-board`, { width: 4.8, height: 2.7 }, scene)
    board.parent = landmarkRoot
    board.position.y = 2.55
    board.billboardMode = TransformNode.BILLBOARDMODE_Y
    board.material = boardMaterial

    const post = MeshBuilder.CreateBox(`${name}-${landmark.id}-post`, { width: 0.22, height: 2.6, depth: 0.22 }, scene)
    post.parent = landmarkRoot
    post.position.y = 1.3
    post.material = postMaterial

    const texture = AdvancedDynamicTexture.CreateForMesh(board, 1024, 576, false)
    textures.push(texture)
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
      for (const texture of textures) texture.dispose()
      root.dispose()
      boardMaterial.dispose()
      postMaterial.dispose()
    },
  }
}
