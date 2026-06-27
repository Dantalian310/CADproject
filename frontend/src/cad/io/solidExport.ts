import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { CadDocument } from '@/cad/model/document'
import { ThreeGeometryKernel } from '@/cad/geometry/threeGeometryKernel'

export async function exportCadDocumentStl(document: CadDocument): Promise<Blob> {
  const exporter = new STLExporter()
  const group = buildSolidGroup(document)
  const stl = exporter.parse(group, { binary: false }) as string
  return new Blob([stl], { type: 'model/stl;charset=utf-8' })
}

export async function exportCadDocumentGlb(document: CadDocument): Promise<Blob> {
  const exporter = new GLTFExporter()
  const group = buildSolidGroup(document)
  const result = await new Promise<ArrayBuffer | object>((resolve, reject) => {
    exporter.parse(group, resolve, reject, { binary: true })
  })
  if (result instanceof ArrayBuffer) {
    return new Blob([result], { type: 'model/gltf-binary' })
  }
  return new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json;charset=utf-8' })
}

function buildSolidGroup(document: CadDocument): THREE.Group {
  const kernel = new ThreeGeometryKernel()
  const group = new THREE.Group()
  for (const descriptor of kernel.buildDocument(document)) {
    if (descriptor.kind === 'line') continue
    group.add(new THREE.Mesh(descriptor.geometry.clone(), descriptor.material.clone()))
  }
  return group
}
