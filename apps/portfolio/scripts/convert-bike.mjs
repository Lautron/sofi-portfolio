// Converts the artist's motorbike FBX into the compact GLB the ride loads.
// Run `npm run convert:bike` after re-exporting assets/source/moto.fbx; the
// GLB is committed so regular builds never need the FBX converter.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { dedup, prune, quantize, weld } from '@gltf-transform/functions'
import convertFbx from 'fbx2gltf'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = join(APP_ROOT, 'assets/source/moto.fbx')
const OUTPUT = join(APP_ROOT, 'src/assets/models/moto.glb')

const workDir = await mkdtemp(join(tmpdir(), 'convert-bike-'))
try {
  // The FBX SDK writes centimetres out as metres, Y up, as glTF expects.
  const converted = await convertFbx(SOURCE, join(workDir, 'moto.glb'), ['--no-khr-lights-punctual'])
  const io = new NodeIO().registerExtensions([KHRMeshQuantization])
  const document = await io.read(converted)

  // Blender exports its scene camera and helper empties too; only meshes ride.
  const hasMesh = (node) => Boolean(node.getMesh()) || node.listChildren().some(hasMesh)
  for (const node of document.getRoot().listNodes()) {
    if (!hasMesh(node)) node.dispose()
  }
  for (const camera of document.getRoot().listCameras()) camera.dispose()

  // Quantized attributes decode in the vertex shader: no decoder to download.
  await document.transform(prune(), dedup(), weld(), quantize())
  await io.write(OUTPUT, document)
  console.log(`Wrote ${OUTPUT}`)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
