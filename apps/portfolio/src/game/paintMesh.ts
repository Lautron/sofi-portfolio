import type { Color3 } from '@babylonjs/core/Maths/math.color'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

/**
 * Gives every vertex of `mesh` one colour. Parts painted this way can be
 * merged into a single mesh that still shows several colours with one
 * white-diffuse material, which keeps draw calls down.
 */
export function paintMesh(mesh: Mesh, color: Color3, alpha = 1): Mesh {
  const count = mesh.getTotalVertices()
  const colors = new Float32Array(count * 4)
  for (let index = 0; index < count; index += 1) {
    colors.set([color.r, color.g, color.b, alpha], index * 4)
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors)
  return mesh
}
