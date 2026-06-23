import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../frontend')

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`[PASS] ${message}`)
}

function nearlyEqual(a, b, tolerance = 0.001) {
  return Math.abs(a - b) <= tolerance
}

function distancePointToLine(point, line) {
  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(point.x - line.start.x, point.y - line.start.y)
  return Math.abs((point.x - line.start.x) * dy - (point.y - line.start.y) * dx) / length
}

const server = await createServer({
  root,
  configFile: false,
  resolve: {
    alias: {
      '@': path.join(root, 'src')
    }
  },
  server: {
    middlewareMode: true
  },
  optimizeDeps: {
    noDiscovery: true,
    include: []
  }
})

try {
  const { ThreeGeometryKernel } = await server.ssrLoadModule('/src/cad/geometry/threeGeometryKernel.ts')
  const { applyRemoteOperation } = await server.ssrLoadModule('/src/collaboration/applyRemoteOperation.ts')
  const { findNearestSketchSnap, sketchEntityKey } = await server.ssrLoadModule('/src/cad/geometry/sketchSnapping.ts')
  const {
    createRectangularArrayPreviewEntities,
    createOffsetPreviewEntities,
    getSketchEntitiesCenter,
    mirrorSketchEntity,
    mirrorSketchEntityAcrossLine,
    offsetSketchEntity,
    rotateSketchEntities,
    rotateSketchEntity,
    translateSketchEntity
  } = await server.ssrLoadModule('/src/cad/geometry/sketchTransforms.ts')
  const {
    applyConstraintsToEntity,
    applyRelationConstraint,
    createDimensionConstraintForEntity,
    isRelationConstraintApplicable
  } = await server.ssrLoadModule('/src/cad/geometry/sketchConstraints.ts')
  const { buildDimensionAnnotations } = await server.ssrLoadModule('/src/cad/geometry/sketchDimensionAnnotations.ts')
  const { buildSketchEntityMeasurements, buildSketchSelectionMeasurements } = await server.ssrLoadModule('/src/cad/geometry/sketchMeasurements.ts')
  const { exportSketchDocumentDxf, exportSketchDocumentSvg } = await server.ssrLoadModule('/src/cad/io/sketchExport.ts')
  const { createLineChamfer, createLineFillet } = await server.ssrLoadModule('/src/cad/geometry/sketchCornerOperations.ts')
  const { resolveCadKeyboardAction } = await server.ssrLoadModule('/src/cad/commands/keyboardShortcuts.ts')
  const { makeArcFromCenterPoints } = await server.ssrLoadModule('/src/cad/geometry/sketchArcGeometry.ts')
  const {
    defaultSketchSnapSettings,
    normalizeAngleStep,
    normalizeGridSize,
    resolveSketchGridStep,
    roundPointToSketchGrid,
    snapPointToSketchAngle
  } = await server.ssrLoadModule('/src/cad/geometry/sketchSnapSettings.ts')
  assert(resolveCadKeyboardAction({ key: 'l' })?.tool === 'line', 'keyboard shortcut selects line tool')
  assert(resolveCadKeyboardAction({ key: 'c' })?.tool === 'circle', 'keyboard shortcut selects circle tool')
  assert(resolveCadKeyboardAction({ key: 'r' })?.tool === 'rectangle', 'keyboard shortcut selects rectangle tool')
  assert(resolveCadKeyboardAction({ key: 'a' })?.tool === 'arc', 'keyboard shortcut selects arc tool')
  assert(resolveCadKeyboardAction({ key: 'q' })?.type === 'toggle-construction', 'keyboard shortcut toggles construction mode')
  assert(resolveCadKeyboardAction({ key: 'Escape' })?.type === 'cancel', 'keyboard shortcut cancels the active command')
  assert(resolveCadKeyboardAction({ key: 'Delete' })?.type === 'delete', 'keyboard shortcut deletes selected geometry')
  assert(resolveCadKeyboardAction({ key: 'z', ctrlKey: true })?.type === 'undo', 'keyboard shortcut maps Ctrl+Z to undo')
  assert(resolveCadKeyboardAction({ key: 'y', ctrlKey: true })?.type === 'redo', 'keyboard shortcut maps Ctrl+Y to redo')
  assert(resolveCadKeyboardAction({ key: 'f' })?.command === 'fit', 'keyboard shortcut maps F to fit view')
  assert(resolveCadKeyboardAction({ key: '5', shiftKey: true })?.command === 'top', 'keyboard shortcut maps Shift+5 to top view')
  assert(resolveCadKeyboardAction({ key: 'e', shiftKey: true })?.tool === 'extrude', 'keyboard shortcut maps Shift+E to extrude')
  assert(resolveCadKeyboardAction({ key: 'l', altKey: true }) === null, 'keyboard shortcuts ignore Alt-modified free navigation input')

  const kernel = new ThreeGeometryKernel()
  const document = {
    schemaVersion: '1.0',
    documentId: 'cad-smoke',
    name: 'CAD Geometry Smoke',
    unit: 'mm',
    metadata: { currentVersion: 1 },
    sketches: [
      {
        id: 'sketch-001',
        name: 'Sketch 1',
        plane: 'XY',
        entities: [
          {
            id: 'rect-001',
            type: 'rectangle',
            name: 'Base Rectangle',
            visible: true,
            origin: { x: 0, y: 0 },
            width: 60,
            height: 40
          },
          {
            id: 'circle-001',
            type: 'circle',
            name: 'Cut Circle',
            visible: true,
            center: { x: 30, y: 20 },
            radius: 8
          },
          {
            id: 'rect-002',
            type: 'rectangle',
            name: 'Tool Rectangle',
            visible: true,
            origin: { x: 20, y: 10 },
            width: 20,
            height: 15
          },
          {
            id: 'arc-001',
            type: 'arc',
            name: 'Reference Arc',
            visible: true,
            center: { x: 45, y: 15 },
            radius: 10,
            startAngle: 0,
            endAngle: 90
          }
        ],
        constraints: []
      }
    ],
    features: [
      {
        id: 'extrude-001',
        type: 'extrude',
        name: 'Base Extrude',
        suppressed: false,
        sourceSketchId: 'sketch-001',
        sourceEntityId: 'rect-001',
        depth: 30,
        operation: 'new'
      },
      {
        id: 'extrude-002',
        type: 'extrude',
        name: 'Tool Extrude',
        suppressed: false,
        sourceSketchId: 'sketch-001',
        sourceEntityId: 'rect-002',
        depth: 25,
        operation: 'new'
      },
      {
        id: 'cut-001',
        type: 'cut',
        name: 'Circle Cut',
        suppressed: false,
        targetFeatureId: 'extrude-001',
        toolSketchId: 'sketch-001',
        toolEntityId: 'circle-001',
        depth: 35
      },
      {
        id: 'boolean-001',
        type: 'boolean',
        name: 'Union Result',
        suppressed: false,
        operation: 'union',
        targetFeatureId: 'cut-001',
        toolFeatureId: 'extrude-002'
      }
    ]
  }

  const meshes = kernel.buildDocument(document)
  const featureMeshes = meshes.filter((mesh) => mesh.kind !== 'line')
  const sketchLines = meshes.filter((mesh) => mesh.kind === 'line')
  assert(sketchLines.length === 4, 'sketch entities render as line descriptors')
  assert(featureMeshes.length === 1, 'consumed feature history renders final boolean result')
  assert(featureMeshes[0].featureId === 'boolean-001', 'final feature is boolean result')
  assert(featureMeshes[0].geometry.attributes.position.count > 0, 'boolean result has vertices')

  const multiPlaneDocument = {
    ...document,
    sketches: [
      {
        id: 'sketch-xz',
        name: 'XZ Sketch',
        plane: 'XZ',
        entities: [{
          id: 'rect-xz',
          type: 'rectangle',
          name: 'XZ Rectangle',
          visible: true,
          origin: { x: 0, y: 0 },
          width: 20,
          height: 30
        }],
        constraints: []
      },
      {
        id: 'sketch-yz',
        name: 'YZ Sketch',
        plane: 'YZ',
        entities: [{
          id: 'circle-yz',
          type: 'circle',
          name: 'YZ Circle',
          visible: true,
          center: { x: 0, y: 0 },
          radius: 5
        }],
        constraints: []
      }
    ],
    features: [
      {
        id: 'extrude-xz',
        type: 'extrude',
        name: 'XZ Extrude',
        suppressed: false,
        sourceSketchId: 'sketch-xz',
        sourceEntityId: 'rect-xz',
        depth: 12,
        operation: 'new'
      },
      {
        id: 'extrude-yz',
        type: 'extrude',
        name: 'YZ Extrude',
        suppressed: false,
        sourceSketchId: 'sketch-yz',
        sourceEntityId: 'circle-yz',
        depth: 14,
        operation: 'new'
      }
    ]
  }
  const multiPlaneMeshes = kernel.buildDocument(multiPlaneDocument).filter((mesh) => mesh.kind !== 'line')
  const xzExtrude = multiPlaneMeshes.find((mesh) => mesh.featureId === 'extrude-xz')
  const yzExtrude = multiPlaneMeshes.find((mesh) => mesh.featureId === 'extrude-yz')
  xzExtrude.geometry.computeBoundingBox()
  yzExtrude.geometry.computeBoundingBox()
  assert(nearlyEqual(xzExtrude.geometry.boundingBox.max.y - xzExtrude.geometry.boundingBox.min.y, 12), 'XZ rectangle extrude uses Y depth')
  assert(nearlyEqual(yzExtrude.geometry.boundingBox.max.x - yzExtrude.geometry.boundingBox.min.x, 14), 'YZ circle extrude uses X depth')

  const constructionDocument = {
    ...document,
    sketches: [
      {
        ...document.sketches[0],
        entities: [
          {
            ...document.sketches[0].entities[0],
            id: 'rect-construction-001',
            construction: true
          }
        ]
      }
    ],
    features: [
      {
        id: 'extrude-construction-001',
        type: 'extrude',
        name: 'Ignored Construction Extrude',
        suppressed: false,
        sourceSketchId: 'sketch-001',
        sourceEntityId: 'rect-construction-001',
        depth: 20,
        operation: 'new'
      }
    ]
  }
  const constructionMeshes = kernel.buildDocument(constructionDocument)
  assert(constructionMeshes.some((mesh) => mesh.kind === 'line' && mesh.material.type === 'LineDashedMaterial'), 'construction sketch entity renders as dashed reference geometry')
  assert(constructionMeshes.every((mesh) => mesh.kind === 'line'), 'construction sketch entity is excluded from solid feature generation')

  const primitiveDocument = {
    ...document,
    sketches: [{ ...document.sketches[0], entities: [] }],
    features: [
      {
        id: 'box-primitive-001',
        type: 'box',
        name: 'Parametric Box',
        suppressed: false,
        position: { x: 0, y: 0, z: 0 },
        length: 60,
        width: 40,
        height: 30
      },
      {
        id: 'sphere-primitive-001',
        type: 'sphere',
        name: 'Parametric Sphere',
        suppressed: false,
        position: { x: 90, y: 0, z: 0 },
        radius: 20
      },
      {
        id: 'cone-primitive-001',
        type: 'cone',
        name: 'Parametric Cone',
        suppressed: false,
        position: { x: 150, y: 0, z: 0 },
        baseRadius: 18,
        height: 50
      }
    ]
  }
  const primitiveMeshes = kernel.buildDocument(primitiveDocument).filter((mesh) => mesh.kind !== 'line')
  assert(primitiveMeshes.length === 3, 'parameterized box sphere and cone render as feature meshes')
  assert(primitiveMeshes.some((mesh) => mesh.featureId === 'sphere-primitive-001' && mesh.geometry.attributes.position.count > 0), 'parameterized sphere produces renderable vertices')

  const sketchSvg = exportSketchDocumentSvg(document)
  assert(sketchSvg.includes('<rect') && sketchSvg.includes('<circle') && sketchSvg.includes('<path'), 'SVG export serializes rectangle, circle, and arc sketch geometry')
  const constructionSvg = exportSketchDocumentSvg(constructionDocument)
  assert(constructionSvg.includes('stroke-dasharray'), 'SVG export preserves construction geometry styling')
  const sketchDxf = exportSketchDocumentDxf(document)
  assert(sketchDxf.includes('\n0\nCIRCLE\n') && sketchDxf.includes('\n0\nARC\n') && sketchDxf.includes('\n0\nLINE\n'), 'DXF export serializes line, circle, and arc entities')
  const constructionDxf = exportSketchDocumentDxf(constructionDocument)
  assert(constructionDxf.includes('\n8\nCONSTRUCTION\n'), 'DXF export places construction geometry on a construction layer')

  const circleCenterSnap = findNearestSketchSnap(document, { x: 31, y: 20 }, 5)
  assert(circleCenterSnap?.label === '圆心', 'object snap finds nearby circle center')

  const rectangleCornerSnap = findNearestSketchSnap(document, { x: 59, y: 39 }, 5)
  assert(rectangleCornerSnap?.label === '角点', 'object snap finds rectangle corner')

  const arcEndpointSnap = findNearestSketchSnap(document, { x: 55, y: 15 }, 5)
  assert(arcEndpointSnap?.label === '圆弧端点', 'object snap finds arc endpoints')

  const excludedSnap = findNearestSketchSnap(document, { x: 31, y: 20 }, 5, {
    excludeEntityKeys: new Set([sketchEntityKey('sketch-001', 'circle-001')])
  })
  assert(excludedSnap?.entityId !== 'circle-001', 'object snap can exclude the entity currently being edited')

  const roundedGridPoint = roundPointToSketchGrid({ x: 12.4, y: -2.6 }, 5)
  assert(roundedGridPoint.x === 10 && roundedGridPoint.y === -5, 'configurable grid snapping rounds points to the selected grid size')
  assert(resolveSketchGridStep({ ...defaultSketchSnapSettings, gridSize: 10 }, false) === 10, 'grid snapping uses configured normal grid step')
  assert(resolveSketchGridStep({ ...defaultSketchSnapSettings, fineGridSize: 0.2 }, true) === 0.2, 'grid snapping uses configured fine grid step')
  assert(normalizeGridSize(-1, 5) === 5, 'grid snapping falls back from invalid grid sizes')
  const snappedAnglePoint = snapPointToSketchAngle({ x: 0, y: 0 }, { x: 10, y: 6 }, 45)
  assert(Math.abs(Math.hypot(snappedAnglePoint.x, snappedAnglePoint.y) - Math.hypot(10, 6)) < 0.001, 'angle snapping preserves pointer distance from origin')
  assert(Math.abs(snappedAnglePoint.x - snappedAnglePoint.y) < 0.001, 'angle snapping rounds direction to the configured angle step')
  assert(normalizeAngleStep(0, 15) === 15, 'angle snapping falls back from invalid angle steps')

  const selectionCenter = getSketchEntitiesCenter(document.sketches[0].entities)
  assert(selectionCenter.x === 30 && selectionCenter.y === 20, 'selection transform center uses merged entity bounds')

  const rotatedLine = rotateSketchEntity({
    id: 'line-transform-001',
    type: 'line',
    name: 'Transform Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 }
  }, { x: 0, y: 0 }, 90)
  assert(rotatedLine.end.x === 0 && rotatedLine.end.y === 10, 'rotate transform turns sketch geometry around a center')

  const arbitraryRotatedLine = rotateSketchEntity({
    id: 'line-transform-045',
    type: 'line',
    name: 'Arbitrary Rotation Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 }
  }, { x: 0, y: 0 }, 45)
  assert(Math.abs(arbitraryRotatedLine.end.x - 7.071) < 0.001 && Math.abs(arbitraryRotatedLine.end.y - 7.071) < 0.001, 'rotate transform accepts arbitrary user angle')

  const createdArc = makeArcFromCenterPoints(
    'arc-transform-001',
    'Transform Arc',
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 }
  )
  assert(createdArc.type === 'arc' && createdArc.radius === 10 && createdArc.startAngle === 0 && createdArc.endAngle === 90, 'arc helper creates center-start-end sketch arcs')

  const rotatedArc = rotateSketchEntity(createdArc, { x: 0, y: 0 }, 90)
  assert(rotatedArc.type === 'arc' && rotatedArc.startAngle === 90 && rotatedArc.endAngle === 180, 'rotate transform updates arc center and endpoint angles')

  const rotatedPreviewEntities = rotateSketchEntities(document.sketches[0].entities.slice(0, 2), 180)
  assert(rotatedPreviewEntities.length === 2 && rotatedPreviewEntities[0].id === 'rect-001', 'rotate preview keeps transformed entities transient and uncommitted')

  const translatedRectangle = translateSketchEntity({
    id: 'rect-transform-spacing',
    type: 'rectangle',
    name: 'Spacing Rectangle',
    visible: true,
    origin: { x: 10, y: 20 },
    width: 15,
    height: 10
  }, { x: 35, y: -15 })
  assert(translatedRectangle.origin.x === 45 && translatedRectangle.origin.y === 5, 'array spacing transform accepts custom offsets')

  const arrayPreviewEntities = createRectangularArrayPreviewEntities([document.sketches[0].entities[0]], 3, 2, { x: 35, y: -15 })
  assert(arrayPreviewEntities.length === 5, 'array preview creates only duplicate preview positions')
  assert(arrayPreviewEntities[0].id === 'rect-001-preview-0-1', 'array preview uses stable preview ids outside persisted document ids')

  const offsetLine = offsetSketchEntity({
    id: 'line-offset-001',
    type: 'line',
    name: 'Offset Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 }
  }, 5)
  assert(offsetLine?.type === 'line' && offsetLine.start.y === 5 && offsetLine.end.y === 5, 'offset transform creates a parallel line at signed distance')

  const offsetRectangle = offsetSketchEntity(document.sketches[0].entities[0], 5)
  assert(
    offsetRectangle?.type === 'rectangle'
      && offsetRectangle.origin.x === -5
      && offsetRectangle.origin.y === -5
      && offsetRectangle.width === 70
      && offsetRectangle.height === 50,
    'offset transform expands rectangle around its center'
  )

  const inwardCircle = offsetSketchEntity(document.sketches[0].entities[1], -3)
  assert(inwardCircle?.type === 'circle' && inwardCircle.radius === 5, 'offset transform supports inward circle offsets')

  const offsetPreviewEntities = createOffsetPreviewEntities(document.sketches[0].entities.slice(0, 2), 5)
  assert(offsetPreviewEntities.length === 2 && offsetPreviewEntities[0].id === 'rect-001-offset-preview', 'offset preview creates transient offset copies')

  const offsetArc = offsetSketchEntity(createdArc, 5)
  assert(offsetArc?.type === 'arc' && offsetArc.radius === 15, 'offset transform changes arc radius')

  const cornerLineA = {
    id: 'line-corner-a',
    type: 'line',
    name: 'Corner Line A',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 }
  }
  const cornerLineB = {
    id: 'line-corner-b',
    type: 'line',
    name: 'Corner Line B',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 100 }
  }
  const filletCorner = createLineFillet(cornerLineA, cornerLineB, 10, 'arc-fillet-test', 'Fillet Test')
  assert(
    filletCorner?.connector.type === 'arc'
      && filletCorner.lineA.start.x === 10
      && filletCorner.lineB.start.y === 10
      && filletCorner.connector.center.x === 10
      && filletCorner.connector.center.y === 10,
    'line fillet trims two lines and creates a tangent arc'
  )
  const chamferCorner = createLineChamfer(cornerLineA, cornerLineB, 12, 'line-chamfer-test', 'Chamfer Test')
  assert(
    chamferCorner?.connector.type === 'line'
      && chamferCorner.lineA.start.x === 12
      && chamferCorner.lineB.start.y === 12
      && chamferCorner.connector.start.x === 12
      && chamferCorner.connector.end.y === 12,
    'line chamfer trims two lines and creates a connecting segment'
  )

  const mirroredCircle = mirrorSketchEntity({
    id: 'circle-transform-001',
    type: 'circle',
    name: 'Transform Circle',
    visible: true,
    center: { x: 15, y: 5 },
    radius: 4
  }, { x: 10, y: 0 }, 'horizontal')
  assert(mirroredCircle.center.x === 5 && mirroredCircle.center.y === 5, 'mirror transform reflects sketch geometry across a vertical mirror line')

  const lineMirroredCircle = mirrorSketchEntityAcrossLine({
    id: 'circle-line-mirror-001',
    type: 'circle',
    name: 'Line Mirrored Circle',
    visible: true,
    center: { x: 10, y: 0 },
    radius: 4
  }, {
    id: 'mirror-axis-001',
    type: 'line',
    name: 'Mirror Axis',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 10 }
  })
  assert(lineMirroredCircle.center.x === 0 && lineMirroredCircle.center.y === 10, 'line mirror reflects sketch geometry across arbitrary selected line')

  const constrainedLine = applyConstraintsToEntity({
    id: 'line-constraint-001',
    type: 'line',
    name: 'Constraint Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 30, y: 20 }
  }, [
    { id: 'constraint-horizontal-001', type: 'horizontal', entityId: 'line-constraint-001' },
    { id: 'constraint-length-001', type: 'dimension', entityId: 'line-constraint-001', dimension: 'length', value: 50 }
  ])
  assert(constrainedLine.end.x === 50 && constrainedLine.end.y === 0, 'horizontal and dimension constraints drive line geometry')

  const fixedCircle = applyConstraintsToEntity({
    id: 'circle-fixed-001',
    type: 'circle',
    name: 'Renamed Fixed Circle',
    visible: true,
    center: { x: 100, y: 100 },
    radius: 20
  }, [
    { id: 'constraint-fixed-001', type: 'fixed', entityId: 'circle-fixed-001' }
  ], {
    id: 'circle-fixed-001',
    type: 'circle',
    name: 'Fixed Circle',
    visible: true,
    center: { x: 10, y: 10 },
    radius: 6
  })
  assert(fixedCircle.name === 'Renamed Fixed Circle' && fixedCircle.center.x === 10 && fixedCircle.radius === 6 && fixedCircle.locked === true, 'fixed constraint preserves geometry while allowing metadata updates')

  const manuallyLockedLine = applyConstraintsToEntity({
    id: 'line-manual-lock-001',
    type: 'line',
    name: 'Manual Locked Line',
    visible: true,
    locked: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 }
  }, [])
  assert(manuallyLockedLine.locked === true && manuallyLockedLine.end.x === 10, 'manual lock state survives constraint normalization')

  const rectangleDimension = createDimensionConstraintForEntity('constraint-rect-width-001', {
    id: 'rect-dimension-001',
    type: 'rectangle',
    name: 'Dimension Rectangle',
    visible: true,
    origin: { x: 0, y: 0 },
    width: 80,
    height: 20
  }, [])
  assert(rectangleDimension?.dimension === 'width' && rectangleDimension.value === 80, 'dimension constraint initializes from current entity size')

  const arcDimension = createDimensionConstraintForEntity('constraint-arc-radius-001', createdArc, [])
  assert(arcDimension?.dimension === 'radius' && arcDimension.value === 10, 'dimension constraint initializes from current arc radius')

  const relationSourceCircle = {
    id: 'circle-relation-source',
    type: 'circle',
    name: 'Relation Source Circle',
    visible: true,
    center: { x: 12, y: 16 },
    radius: 14
  }
  const relationTargetCircle = {
    id: 'circle-relation-target',
    type: 'circle',
    name: 'Relation Target Circle',
    visible: true,
    center: { x: 50, y: 60 },
    radius: 5
  }
  assert(isRelationConstraintApplicable('concentric', relationSourceCircle, relationTargetCircle), 'concentric relation applies to two circles')
  const concentricCircle = applyRelationConstraint(relationSourceCircle, relationTargetCircle, {
    id: 'constraint-concentric-001',
    type: 'concentric',
    entityId: relationSourceCircle.id,
    targetEntityId: relationTargetCircle.id
  })
  assert(concentricCircle.center.x === 12 && concentricCircle.center.y === 16, 'concentric relation aligns circle centers')
  const equalRadiusCircle = applyRelationConstraint(relationSourceCircle, relationTargetCircle, {
    id: 'constraint-equal-radius-001',
    type: 'equalRadius',
    entityId: relationSourceCircle.id,
    targetEntityId: relationTargetCircle.id
  })
  assert(equalRadiusCircle.radius === 14, 'equal radius relation copies source circle radius')

  const parallelLine = applyRelationConstraint({
    id: 'line-relation-source',
    type: 'line',
    name: 'Relation Source Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 20, y: 0 }
  }, {
    id: 'line-relation-target',
    type: 'line',
    name: 'Relation Target Line',
    visible: true,
    start: { x: 10, y: 10 },
    end: { x: 10, y: 30 }
  }, {
    id: 'constraint-parallel-001',
    type: 'parallel',
    entityId: 'line-relation-source',
    targetEntityId: 'line-relation-target'
  })
  assert(parallelLine.end.x === 30 && parallelLine.end.y === 10, 'parallel relation preserves target length and matches source direction')

  const perpendicularLine = applyRelationConstraint({
    id: 'line-perpendicular-source',
    type: 'line',
    name: 'Perpendicular Source Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 20, y: 0 }
  }, {
    id: 'line-perpendicular-target',
    type: 'line',
    name: 'Perpendicular Target Line',
    visible: true,
    start: { x: 5, y: 5 },
    end: { x: 25, y: 5 }
  }, {
    id: 'constraint-perpendicular-001',
    type: 'perpendicular',
    entityId: 'line-perpendicular-source',
    targetEntityId: 'line-perpendicular-target'
  })
  assert(perpendicularLine.end.x === 5 && perpendicularLine.end.y === 25, 'perpendicular relation rotates target line 90 degrees from source')

  const tangentLine = applyRelationConstraint({
    id: 'circle-tangent-source',
    type: 'circle',
    name: 'Tangent Source Circle',
    visible: true,
    center: { x: 0, y: 0 },
    radius: 10
  }, {
    id: 'line-tangent-target',
    type: 'line',
    name: 'Tangent Target Line',
    visible: true,
    start: { x: -8, y: 0 },
    end: { x: 8, y: 0 }
  }, {
    id: 'constraint-tangent-line-001',
    type: 'tangent',
    entityId: 'circle-tangent-source',
    targetEntityId: 'line-tangent-target'
  })
  assert(
    nearlyEqual(distancePointToLine({ x: 0, y: 0 }, tangentLine), 10),
    'tangent relation offsets target line to circle radius distance'
  )

  const tangentCircleToLine = applyRelationConstraint({
    id: 'line-tangent-source',
    type: 'line',
    name: 'Tangent Source Line',
    visible: true,
    start: { x: -10, y: 0 },
    end: { x: 10, y: 0 }
  }, {
    id: 'circle-tangent-target',
    type: 'circle',
    name: 'Tangent Target Circle',
    visible: true,
    center: { x: 0, y: 2 },
    radius: 6
  }, {
    id: 'constraint-tangent-circle-line-001',
    type: 'tangent',
    entityId: 'line-tangent-source',
    targetEntityId: 'circle-tangent-target'
  })
  assert(tangentCircleToLine.center.y === 6, 'tangent relation offsets target circle to line radius distance')

  const tangentCircleToCircle = applyRelationConstraint({
    id: 'circle-tangent-source-2',
    type: 'circle',
    name: 'Tangent Source Circle 2',
    visible: true,
    center: { x: 0, y: 0 },
    radius: 10
  }, {
    id: 'circle-tangent-target-2',
    type: 'circle',
    name: 'Tangent Target Circle 2',
    visible: true,
    center: { x: 3, y: 0 },
    radius: 5
  }, {
    id: 'constraint-tangent-circle-circle-001',
    type: 'tangent',
    entityId: 'circle-tangent-source-2',
    targetEntityId: 'circle-tangent-target-2'
  })
  assert(tangentCircleToCircle.center.x === 15 && tangentCircleToCircle.center.y === 0, 'tangent relation spaces two circles by summed radii')

  const annotatedDocument = {
    ...document,
    sketches: [
      {
        ...document.sketches[0],
        constraints: [
          { id: 'constraint-width-001', type: 'dimension', entityId: 'rect-001', dimension: 'width', value: 60 },
          { id: 'constraint-height-001', type: 'dimension', entityId: 'rect-001', dimension: 'height', value: 40 },
          { id: 'constraint-radius-001', type: 'dimension', entityId: 'circle-001', dimension: 'radius', value: 8 },
          { id: 'constraint-arc-radius-001', type: 'dimension', entityId: 'arc-001', dimension: 'radius', value: 10 }
        ]
      }
    ]
  }
  const annotations = buildDimensionAnnotations(annotatedDocument)
  assert(annotations.length === 4, 'dimension annotations are generated from sketch dimension constraints')
  assert(annotations.some((annotation) => annotation.label === '宽度 60 mm'), 'dimension annotation labels rectangle width')
  assert(annotations.some((annotation) => annotation.label === '半径 8 mm'), 'dimension annotation labels circle radius')
  assert(annotations.some((annotation) => annotation.entityId === 'arc-001' && annotation.label === '半径 10 mm'), 'dimension annotation labels arc radius')
  const lineMeasurements = buildSketchEntityMeasurements({
    id: 'line-measure-001',
    type: 'line',
    name: 'Measured Line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 3, y: 4 }
  })
  assert(lineMeasurements.some((item) => item.label === '长度' && item.value === '5 mm'), 'measurement panel reports line length')

  const circleMeasurements = buildSketchEntityMeasurements(document.sketches[0].entities[1])
  assert(circleMeasurements.some((item) => item.label === '直径' && item.value === '16 mm'), 'measurement panel reports circle diameter')

  const arcMeasurements = buildSketchEntityMeasurements(document.sketches[0].entities[3])
  assert(arcMeasurements.some((item) => item.label === '圆心角' && item.value === '90°'), 'measurement panel reports arc central angle')

  const selectionMeasurements = buildSketchSelectionMeasurements(document.sketches[0].entities.slice(0, 2))
  assert(selectionMeasurements.some((item) => item.label === '实体数量' && item.value === '2'), 'measurement panel reports selected entity count')
  assert(selectionMeasurements.some((item) => item.label === '范围宽度' && item.value === '60 mm'), 'measurement panel reports selection bounding width')

  const createdDocument = applyRemoteOperation(document, {
    operationId: 'op-create-many',
    documentId: 1,
    type: 'sketch.entities.created',
    targetId: 'selection',
    baseVersion: 1,
    payload: {
      entities: [
        {
          sketchId: 'sketch-001',
          entity: {
            id: 'line-batch-001',
            type: 'line',
            name: 'Batch Line',
            visible: true,
            start: { x: 0, y: 0 },
            end: { x: 20, y: 20 }
          }
        },
        {
          sketchId: 'sketch-001',
          entity: {
            id: 'circle-batch-001',
            type: 'circle',
            name: 'Batch Circle',
            visible: true,
            center: { x: 80, y: 20 },
            radius: 10
          }
        }
      ]
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(createdDocument.sketches[0].entities.length === 6, 'remote batch create adds sketch entities')

  const updatedDocument = applyRemoteOperation(createdDocument, {
    operationId: 'op-update-many',
    documentId: 1,
    type: 'sketch.entities.updated',
    targetId: 'selection',
    baseVersion: 1,
    payload: {
      updates: [
        {
          sketchId: 'sketch-001',
          after: {
            id: 'line-batch-001',
            type: 'line',
            name: 'Batch Line Moved',
            visible: true,
            start: { x: 10, y: 10 },
            end: { x: 30, y: 30 }
          }
        },
        {
          sketchId: 'sketch-001',
          after: {
            id: 'circle-batch-001',
            type: 'circle',
            name: 'Batch Circle Bigger',
            visible: true,
            center: { x: 90, y: 20 },
            radius: 15
          }
        }
      ]
    },
    clientTimestamp: new Date().toISOString()
  })
  const movedLine = updatedDocument.sketches[0].entities.find((entity) => entity.id === 'line-batch-001')
  assert(movedLine?.name === 'Batch Line Moved', 'remote batch update replaces sketch entities')

  const cornerRemoteDocument = applyRemoteOperation(updatedDocument, {
    operationId: 'op-corner-modified',
    documentId: 1,
    type: 'sketch.entities.updated',
    targetId: 'corner-fillet',
    baseVersion: 1,
    payload: {
      updates: [
        {
          sketchId: 'sketch-001',
          after: {
            id: 'line-batch-001',
            type: 'line',
            name: 'Batch Line Trimmed',
            visible: true,
            start: { x: 12, y: 12 },
            end: { x: 30, y: 30 }
          }
        }
      ],
      createdEntities: [
        {
          sketchId: 'sketch-001',
          entity: {
            id: 'arc-remote-fillet',
            type: 'arc',
            name: 'Remote Fillet',
            visible: true,
            center: { x: 20, y: 20 },
            radius: 8,
            startAngle: 180,
            endAngle: 270
          }
        }
      ]
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(
    cornerRemoteDocument.sketches[0].entities.some((entity) => entity.id === 'arc-remote-fillet')
      && cornerRemoteDocument.sketches[0].entities.find((entity) => entity.id === 'line-batch-001')?.name === 'Batch Line Trimmed',
    'remote batch update can add corner modification connector geometry'
  )

  const deletedDocument = applyRemoteOperation(cornerRemoteDocument, {
    operationId: 'op-delete-many',
    documentId: 1,
    type: 'sketch.entities.deleted',
    targetId: 'selection',
    baseVersion: 1,
    payload: {
      entities: [
        { sketchId: 'sketch-001', entityId: 'line-batch-001' },
        { sketchId: 'sketch-001', entityId: 'circle-batch-001' }
      ]
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(!deletedDocument.sketches[0].entities.some((entity) => entity.id === 'line-batch-001' || entity.id === 'circle-batch-001'), 'remote batch delete removes sketch entities')

  const remotePrimitiveDocument = applyRemoteOperation(document, {
    operationId: 'op-primitive-created',
    documentId: 1,
    type: 'feature.created',
    targetId: 'sphere-remote-001',
    baseVersion: 1,
    payload: {
      feature: {
        id: 'sphere-remote-001',
        type: 'sphere',
        name: 'Remote Sphere',
        suppressed: false,
        position: { x: 10, y: 20, z: 0 },
        radius: 15
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(remotePrimitiveDocument.features.some((feature) => feature.id === 'sphere-remote-001'), 'remote primitive feature create stores a parameterized sphere')

  const remotePrimitiveUpdatedDocument = applyRemoteOperation(remotePrimitiveDocument, {
    operationId: 'op-primitive-updated',
    documentId: 1,
    type: 'feature.updated',
    targetId: 'sphere-remote-001',
    baseVersion: 1,
    payload: {
      feature: {
        id: 'sphere-remote-001',
        type: 'sphere',
        name: 'Remote Sphere Moved',
        suppressed: false,
        position: { x: 30, y: 40, z: 0 },
        radius: 22
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(remotePrimitiveUpdatedDocument.features.find((feature) => feature.id === 'sphere-remote-001')?.radius === 22, 'remote primitive feature update replaces parameters')

  const remoteFeatureBatchUpdatedDocument = applyRemoteOperation(remotePrimitiveUpdatedDocument, {
    operationId: 'op-features-updated',
    documentId: 1,
    type: 'feature.updated',
    targetId: 'selection',
    baseVersion: 1,
    payload: {
      updates: [
        {
          after: {
            id: 'sphere-remote-001',
            type: 'sphere',
            name: 'Remote Sphere Batch Moved',
            suppressed: false,
            position: { x: 50, y: 60, z: 0 },
            radius: 22
          }
        },
        {
          after: {
            id: 'extrude-001',
            type: 'extrude',
            name: 'Base Extrude Batch Renamed',
            suppressed: false,
            sourceSketchId: 'sketch-001',
            sourceEntityId: 'rect-001',
            depth: 30,
            operation: 'new'
          }
        }
      ]
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(
    remoteFeatureBatchUpdatedDocument.features.find((feature) => feature.id === 'sphere-remote-001')?.position.x === 50
      && remoteFeatureBatchUpdatedDocument.features.find((feature) => feature.id === 'extrude-001')?.name === 'Base Extrude Batch Renamed',
    'remote batch feature update replaces selected features'
  )

  const remoteFeatureBatchDeletedDocument = applyRemoteOperation(remoteFeatureBatchUpdatedDocument, {
    operationId: 'op-features-deleted',
    documentId: 1,
    type: 'feature.deleted',
    targetId: 'selection',
    baseVersion: 1,
    payload: {
      featureIds: ['sphere-remote-001']
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(!remoteFeatureBatchDeletedDocument.features.some((feature) => feature.id === 'sphere-remote-001'), 'remote batch feature delete removes selected features')

  const constraintAddedDocument = applyRemoteOperation(document, {
    operationId: 'op-constraint-added',
    documentId: 1,
    type: 'constraint.added',
    targetId: 'constraint-radius-001',
    baseVersion: 1,
    payload: {
      sketchId: 'sketch-001',
      constraint: {
        id: 'constraint-radius-001',
        type: 'dimension',
        entityId: 'circle-001',
        dimension: 'radius',
        value: 12
      },
      entity: {
        id: 'circle-001',
        type: 'circle',
        name: 'Cut Circle',
        visible: true,
        center: { x: 30, y: 20 },
        radius: 12
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(constraintAddedDocument.sketches[0].constraints.length === 1, 'remote constraint add stores sketch constraint')
  assert(constraintAddedDocument.sketches[0].entities.find((entity) => entity.id === 'circle-001')?.radius === 12, 'remote constraint add can update driven entity')

  const constraintUpdatedDocument = applyRemoteOperation(constraintAddedDocument, {
    operationId: 'op-constraint-updated',
    documentId: 1,
    type: 'constraint.updated',
    targetId: 'constraint-radius-001',
    baseVersion: 1,
    payload: {
      sketchId: 'sketch-001',
      constraint: {
        id: 'constraint-radius-001',
        type: 'dimension',
        entityId: 'circle-001',
        dimension: 'radius',
        value: 18
      },
      entity: {
        id: 'circle-001',
        type: 'circle',
        name: 'Cut Circle',
        visible: true,
        center: { x: 30, y: 20 },
        radius: 18
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(constraintUpdatedDocument.sketches[0].constraints[0].value === 18, 'remote constraint update replaces constraint value')
  assert(constraintUpdatedDocument.sketches[0].entities.find((entity) => entity.id === 'circle-001')?.radius === 18, 'remote constraint update replaces driven entity')

  const constraintRemovedDocument = applyRemoteOperation(constraintUpdatedDocument, {
    operationId: 'op-constraint-removed',
    documentId: 1,
    type: 'constraint.removed',
    targetId: 'constraint-radius-001',
    baseVersion: 1,
    payload: {
      sketchId: 'sketch-001',
      constraintId: 'constraint-radius-001'
    },
    clientTimestamp: new Date().toISOString()
  })
  assert(constraintRemovedDocument.sketches[0].constraints.length === 0, 'remote constraint remove deletes sketch constraint')

  const relationDocument = {
    schemaVersion: '1.0',
    documentId: 'relation-smoke',
    name: 'Relation Smoke',
    unit: 'mm',
    metadata: { currentVersion: 1 },
    sketches: [
      {
        id: 'sketch-001',
        name: 'Sketch 1',
        plane: 'XY',
        entities: [
          relationSourceCircle,
          relationTargetCircle
        ],
        constraints: []
      }
    ],
    features: []
  }
  const relationAddedDocument = applyRemoteOperation(relationDocument, {
    operationId: 'op-relation-added',
    documentId: 1,
    type: 'constraint.added',
    targetId: 'constraint-concentric-remote',
    baseVersion: 1,
    payload: {
      sketchId: 'sketch-001',
      constraint: {
        id: 'constraint-concentric-remote',
        type: 'concentric',
        entityId: relationSourceCircle.id,
        targetEntityId: relationTargetCircle.id
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  const relatedTarget = relationAddedDocument.sketches[0].entities.find((entity) => entity.id === relationTargetCircle.id)
  assert(relatedTarget.center.x === relationSourceCircle.center.x && relatedTarget.center.y === relationSourceCircle.center.y, 'remote relation add solves target geometry')

  const relationSourceMovedDocument = applyRemoteOperation(relationAddedDocument, {
    operationId: 'op-relation-source-moved',
    documentId: 1,
    type: 'sketch.entity.updated',
    targetId: relationSourceCircle.id,
    baseVersion: 1,
    payload: {
      sketchId: 'sketch-001',
      entity: {
        ...relationSourceCircle,
        center: { x: 44, y: 24 }
      }
    },
    clientTimestamp: new Date().toISOString()
  })
  const movedRelationTarget = relationSourceMovedDocument.sketches[0].entities.find((entity) => entity.id === relationTargetCircle.id)
  assert(movedRelationTarget.center.x === 44 && movedRelationTarget.center.y === 24, 'remote source update re-solves relation target')

  console.log('CAD geometry smoke test completed.')
} finally {
  await server.close()
}
