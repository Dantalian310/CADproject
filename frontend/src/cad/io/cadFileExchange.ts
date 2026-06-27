import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { CadDocument, MeshFeature } from '@/cad/model/document'
import { createCadId } from '@/cad/model/ids'

export interface CloudCadFilePackage {
  fileType: 'cloudcad'
  formatVersion: '1.0'
  exportedAt: string
  snapshot: CadDocument
}

export interface ImportedCadFile {
  document: CadDocument
  suggestedName: string
  sourceFormat: string
}

export function createCloudCadPackage(snapshot: CadDocument): CloudCadFilePackage {
  return {
    fileType: 'cloudcad',
    formatVersion: '1.0',
    exportedAt: new Date().toISOString(),
    snapshot
  }
}

export async function loadCadDocumentFromFile(file: File): Promise<ImportedCadFile> {
  const extension = fileExtension(file.name)
  if (extension === 'cloudcad' || extension === 'json') {
    return loadCloudCadDocument(file, extension)
  }
  if (extension === 'stl') {
    return loadStlDocument(file)
  }
  if (extension === 'gltf' || extension === 'glb') {
    return loadGltfDocument(file, extension)
  }
  if (extension === 'step' || extension === 'stp' || extension === 'dwg') {
    throw new Error('当前浏览器版暂不支持直接解析 STEP/DWG。建议先转换为 STL 或 glTF/GLB 后导入，后续可接入服务端 OpenCascade/DWG 转换器。')
  }
  throw new Error('暂不支持该模型文件格式')
}

async function loadCloudCadDocument(file: File, extension: string): Promise<ImportedCadFile> {
  const parsed = JSON.parse(await file.text()) as unknown
  const snapshot = isCloudCadPackage(parsed) ? parsed.snapshot : parsed as Partial<CadDocument>
  const document = normalizeSnapshot(snapshot)
  return {
    document,
    suggestedName: document.name || trimExtension(file.name),
    sourceFormat: extension
  }
}

async function loadStlDocument(file: File): Promise<ImportedCadFile> {
  const loader = new STLLoader()
  const geometry = loader.parse(await file.arrayBuffer())
  const feature = meshFeatureFromGeometry(geometry, trimExtension(file.name), 'stl')
  return {
    document: createMeshDocument(trimExtension(file.name), [feature]),
    suggestedName: trimExtension(file.name),
    sourceFormat: 'stl'
  }
}

async function loadGltfDocument(file: File, extension: 'gltf' | 'glb'): Promise<ImportedCadFile> {
  const loader = new GLTFLoader()
  const source = extension === 'gltf' ? await file.text() : await file.arrayBuffer()
  const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>((resolve, reject) => {
    loader.parse(source, '', resolve, reject)
  })
  gltf.scene.updateMatrixWorld(true)
  const features: MeshFeature[] = []
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    features.push(meshFeatureFromGeometry(geometry, mesh.name || `${trimExtension(file.name)} ${features.length + 1}`, extension, materialColor(mesh.material)))
  })
  if (features.length === 0) {
    throw new Error('glTF/GLB 文件中没有可导入的网格')
  }
  return {
    document: createMeshDocument(trimExtension(file.name), features),
    suggestedName: trimExtension(file.name),
    sourceFormat: extension
  }
}

function meshFeatureFromGeometry(
  geometry: THREE.BufferGeometry,
  name: string,
  format: MeshFeature['format'],
  color = '#94a3b8'
): MeshFeature {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  source.computeVertexNormals()
  const position = source.getAttribute('position')
  if (!position || position.count < 3) {
    throw new Error('网格缺少有效顶点')
  }
  return {
    id: createCadId('mesh'),
    type: 'mesh',
    name,
    suppressed: false,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    format,
    vertices: Array.from(position.array as ArrayLike<number>),
    color
  }
}

function createMeshDocument(name: string, features: MeshFeature[]): CadDocument {
  return {
    schemaVersion: '1.0',
    documentId: 'imported',
    name,
    unit: 'mm',
    metadata: { currentVersion: 0 },
    sketches: [],
    features,
    assemblies: []
  }
}

function normalizeSnapshot(value: Partial<CadDocument>): CadDocument {
  if (!Array.isArray(value.sketches) || !Array.isArray(value.features)) {
    throw new Error('文件缺少 sketches 或 features，无法作为 CAD 模型导入')
  }
  return {
    schemaVersion: value.schemaVersion || '1.0',
    documentId: value.documentId || 'imported',
    name: value.name || '导入模型',
    unit: value.unit || 'mm',
    metadata: value.metadata || { currentVersion: 0 },
    sketches: value.sketches,
    features: value.features,
    assemblies: value.assemblies ?? []
  }
}

function isCloudCadPackage(value: unknown): value is CloudCadFilePackage {
  return Boolean(
    value
      && typeof value === 'object'
      && (value as Partial<CloudCadFilePackage>).fileType === 'cloudcad'
      && (value as Partial<CloudCadFilePackage>).snapshot
  )
}

function materialColor(material: THREE.Material | THREE.Material[]): string {
  const item = Array.isArray(material) ? material[0] : material
  const maybeColor = item as THREE.Material & { color?: THREE.Color }
  return maybeColor.color ? `#${maybeColor.color.getHexString()}` : '#94a3b8'
}

function fileExtension(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
}

function trimExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/i, '') || '导入模型'
}
