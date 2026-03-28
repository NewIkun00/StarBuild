import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import chargerCanvasImageSrc from '../../assets/CDZSVG.svg'
import chargerPreviewImageSrc from '../../assets/CDZ555.png'
import storagePreviewImageSrc from '../../assets/SBchunenggui.png'
import storage261ImageSrc from '../../assets/CNG26111.svg'
import storage418ImageSrc from '../../assets/CNG418888.svg'
import parkingPreviewImageSrc from '../../assets/TYxiaochechewei.png'
import { Circle, FastLayer, Group, Image as KonvaImage, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { normalizeParkingParams } from '../lib/parkingSlots'
import { normalizeStorageModel } from '../lib/storageCatalog'
import { getElementMeterSize, getElementSceneSize } from '../lib/sceneGeometry'
import { getUnitsPerMeter } from '../lib/units'
import type { ElementType, ParkingParams, SceneElement, StorageParams, TileType } from '../types/scene'
import { useEditorStore } from '../store/editorStore'

const MIN_SCALE = 0.3
const MAX_SCALE = 15
const WHEEL_PAN_STEP = 64
const ELEMENT_HOVER_OUTLINE = '#467AF7'
const SELECTED_LABEL_GAP = 4
const SELECTED_LABEL_PADDING_X = 12
const SELECTED_LABEL_PADDING_Y = 8
const SELECTED_LABEL_RADIUS = 4
const SELECTED_LABEL_FONT_SIZE = 12
const SELECTED_LABEL_LINE_HEIGHT = 1
const SELECTED_LABEL_FONT_FAMILY =
  "'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"

Konva.dragButtons = [0]

type Viewport = {
  x: number
  y: number
  scale: number
}

type PerfSnapshot = {
  fps: number
  zoomMs: number
  panMs: number
  selectMs: number
  storeMs: number
  cacheMs: number
  wheelCount: number
  panCount: number
  selectCount: number
  storeCount: number
}

type DragPreview = {
  type: ElementType
  x: number
  y: number
}

type MeasureDraft = {
  startX: number
  startY: number
  endX: number
  endY: number
}

type SelectionDraft = {
  startX: number
  startY: number
  endX: number
  endY: number
  append: boolean
}

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type ClipboardSnapshot = {
  elements: SceneElement[]
}

type TileBatch = {
  tileType: TileType
  fill: string
  tiles: Array<{ x: number; y: number }>
}

function readDraggedElementType(dataTransfer: DataTransfer | null): ElementType | null {
  if (!dataTransfer) {
    return null
  }

  const raw =
    dataTransfer.getData('application/x-starbuild-element') ||
    dataTransfer.getData('text/plain')
  if (!raw) {
    return null
  }

  try {
    return (JSON.parse(raw) as { type: ElementType }).type
  } catch {
    return null
  }
}

function useImageAsset(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const asset = new window.Image()
    asset.decoding = 'async'
    asset.src = src
    asset.onload = () => setImage(asset)
    asset.onerror = () => setImage(null)

    return () => {
      asset.onload = null
      asset.onerror = null
    }
  }, [src])

  return image
}

function getElementBounds(element: { x: number; y: number; rotation: number }, size: { width: number; height: number }): Bounds {
  const halfWidth = size.width / 2
  const halfHeight = size.height / 2
  const radians = (element.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((corner) => ({
    x: element.x + corner.x * cos - corner.y * sin,
    y: element.y + corner.x * sin + corner.y * cos,
  }))

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  }
}

function doBoundsIntersect(a: Bounds, b: Bounds) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

function measureSelectedLabelTextWidth(text: string) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return Math.max(1, text.length * SELECTED_LABEL_FONT_SIZE)
  }

  context.font = `${SELECTED_LABEL_FONT_SIZE}px ${SELECTED_LABEL_FONT_FAMILY}`
  return Math.ceil(context.measureText(text).width)
}

function cloneSceneElements(elements: SceneElement[]) {
  return JSON.parse(JSON.stringify(elements)) as SceneElement[]
}

export const EditorCanvas2D = memo(function EditorCanvas2D() {
  const scene = useEditorStore((state) => state.scene)
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const groundEditAction = useEditorStore((state) => state.groundEditAction)
  const groundEditMode = useEditorStore((state) => state.groundEditMode)
  const selectedId = useEditorStore((state) => state.selectedId)
  const showGrid = useEditorStore((state) => state.showGrid)
  const measureMode = useEditorStore((state) => state.measureMode)
  const moveElement = useEditorStore((state) => state.moveElement)
  const moveElementsBy = useEditorStore((state) => state.moveElementsBy)
  const selectElement = useEditorStore((state) => state.selectElement)
  const selectElements = useEditorStore((state) => state.selectElements)
  const addElementAt = useEditorStore((state) => state.addElementAt)
  const insertElementsAt = useEditorStore((state) => state.insertElementsAt)
  const deleteSelectedElement = useEditorStore((state) => state.deleteSelectedElement)
  const undo = useEditorStore((state) => state.undo)
  const applyTiles = useEditorStore((state) => state.applyTiles)
  const setMeasureMode = useEditorStore((state) => state.setMeasureMode)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridOverlayRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const tilesDisplayGroupRef = useRef<Konva.Group | null>(null)
  const elementsDisplayGroupRef = useRef<Konva.Group | null>(null)
  const elementsHitGroupRef = useRef<Konva.Group | null>(null)
  const tilesDisplayLayerRef = useRef<Konva.Layer | null>(null)
  const elementsDisplayLayerRef = useRef<Konva.Layer | null>(null)
  const selectedLabelLayerRef = useRef<Konva.Layer | null>(null)
  const selectedLabelGroupRef = useRef<Konva.Group | null>(null)
  const selectedLabelRectRef = useRef<Konva.Rect | null>(null)
  const selectedLabelTextRef = useRef<Konva.Text | null>(null)
  const multiSelectedOutlineLayerRef = useRef<Konva.Layer | null>(null)
  const multiSelectedOutlineGroupRef = useRef<Konva.Group | null>(null)
  const multiSelectedOutlineRectRef = useRef<Konva.Rect | null>(null)
  const elementNodeMapRef = useRef<Record<string, Konva.Node | null>>({})
  const elementHitNodeMapRef = useRef<Record<string, Konva.Rect | null>>({})
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const panOriginRef = useRef<{ x: number; y: number } | null>(null)
  const initializedSceneRef = useRef<string | null>(null)
  const multiDragOriginRef = useRef<{
    ids: string[]
    bounds: Bounds
    positions: Record<string, { x: number; y: number }>
    pointerStart: { x: number; y: number }
  } | null>(null)
  const altCloneSourceRef = useRef<{ x: number; y: number } | null>(null)
  const altCloneOriginalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const selectedIdRef = useRef<string | null>(useEditorStore.getState().selectedId)
  const selectedIdsRef = useRef<string[]>(useEditorStore.getState().selectedIds)
  const selectionPreviewIdsRef = useRef<string[]>([])
  const hoveredIdRef = useRef<string | null>(null)
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 })
  const lastPointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const clipboardRef = useRef<ClipboardSnapshot | null>(null)
  const pendingViewportRef = useRef<Viewport | null>(null)
  const frameRef = useRef<number | null>(null)
  const groundBrushFrameRef = useRef<number | null>(null)
  const isGroundBrushingRef = useRef(false)
  const brushedGroundCellsRef = useRef<Set<string>>(new Set())
  const queuedGroundCellsRef = useRef<Map<string, { col: number; row: number }>>(new Map())
  const isPanningRef = useRef(false)
  const didPanRef = useRef(false)
  const didSelectionRef = useRef(false)
  const frameStatsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 })
  const perfRef = useRef<PerfSnapshot>({
    fps: 0,
    zoomMs: 0,
    panMs: 0,
    selectMs: 0,
    storeMs: 0,
    cacheMs: 0,
    wheelCount: 0,
    panCount: 0,
    selectCount: 0,
    storeCount: 0,
  })
  const perfLoopRef = useRef<number | null>(null)
  const dragTypeRef = useRef<ElementType | null>(null)
  const [perfPanel, setPerfPanel] = useState<PerfSnapshot>(perfRef.current)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 })
  const [measureDraft, setMeasureDraft] = useState<MeasureDraft | null>(null)
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null)
  const [groundBrushPreview, setGroundBrushPreview] = useState<{ x: number; y: number } | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    useEditorStore.getState().selectedId,
  )
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<string[]>(
    useEditorStore.getState().selectedIds,
  )
  const chargerCanvasImage = useImageAsset(chargerCanvasImageSrc)
  const chargerPreviewImage = useImageAsset(chargerPreviewImageSrc)
  const parkingPreviewImage = useImageAsset(parkingPreviewImageSrc)
  const storagePreviewImage = useImageAsset(storagePreviewImageSrc)
  const storage261Image = useImageAsset(storage261ImageSrc)
  const storage418Image = useImageAsset(storage418ImageSrc)

  if (!scene) {
    return null
  }

  const currentScene = scene
  const cellSize = currentScene.canvas.gridSize
  const viewport = viewportRef.current
  const selectedElement =
    currentScene.elements.find((element) => element.id === selectedOverlayId) ?? null
  const selectedBounds =
    selectedOverlayIds.length > 1
      ? selectedOverlayIds
          .map((id) => currentScene.elements.find((element) => element.id === id))
          .filter((element): element is (typeof currentScene.elements)[number] => !!element)
          .map((element) => getElementBounds(element, getElementSceneSize(element)))
          .reduce<Bounds | null>((accumulator, bounds) => {
            if (!accumulator) {
              return bounds
            }
            return {
              minX: Math.min(accumulator.minX, bounds.minX),
              minY: Math.min(accumulator.minY, bounds.minY),
              maxX: Math.max(accumulator.maxX, bounds.maxX),
              maxY: Math.max(accumulator.maxY, bounds.maxY),
            }
          }, null)
      : null
  const selectionPreviewIds = useMemo(() => {
    if (!selectionDraft) {
      return []
    }

    const normalizedSelection = {
      minX: Math.min(selectionDraft.startX, selectionDraft.endX),
      minY: Math.min(selectionDraft.startY, selectionDraft.endY),
      maxX: Math.max(selectionDraft.startX, selectionDraft.endX),
      maxY: Math.max(selectionDraft.startY, selectionDraft.endY),
    }

    return currentScene.elements
      .filter((element) =>
        doBoundsIntersect(
          normalizedSelection,
          getElementBounds(element, getElementSceneSize(element)),
        ),
      )
      .map((element) => element.id)
  }, [currentScene.elements, selectionDraft])

  const tileBatches = useMemo<TileBatch[]>(() => {
    const batches = new Map<TileType, TileBatch>()

    currentScene.tiles.forEach((tile) => {
      const existingBatch = batches.get(tile.tileType)
      if (existingBatch) {
        existingBatch.tiles.push({
          x: tile.col * cellSize,
          y: tile.row * cellSize,
        })
        return
      }

      batches.set(tile.tileType, {
        tileType: tile.tileType,
        fill: getTileCatalogItem(tile.tileType).color,
        tiles: [
          {
            x: tile.col * cellSize,
            y: tile.row * cellSize,
          },
        ],
      })
    })

    return Array.from(batches.values())
  }, [cellSize, currentScene.tiles])

  function drawLayers() {
    tilesDisplayLayerRef.current?.batchDraw()
    elementsDisplayLayerRef.current?.batchDraw()
    multiSelectedOutlineLayerRef.current?.batchDraw()
    selectedLabelLayerRef.current?.batchDraw()
  }

  function recordPerf(metric: keyof Omit<PerfSnapshot, 'fps' | 'wheelCount' | 'panCount' | 'selectCount' | 'storeCount'>, value: number) {
    perfRef.current[metric] = Number(value.toFixed(2))
  }

  function refreshLayerCache() {
    const start = performance.now()
    if (tilesDisplayGroupRef.current) {
      tilesDisplayGroupRef.current.clearCache()
    }

    // Keep element vectors crisp while zooming by avoiding bitmap caching.
    if (elementsDisplayGroupRef.current) {
      elementsDisplayGroupRef.current.clearCache()
    }

    drawLayers()
    recordPerf('cacheMs', performance.now() - start)
  }

  function applyElementVisualState(id: string | null) {
    const start = performance.now()
    if (!id) {
      return
    }

    const node = elementNodeMapRef.current[id]
    const element = currentScene.elements.find((item) => item.id === id)
    if (!node || !element) {
      return
    }

    const item = getCatalogItem(element.type)
    const elementSize = getElementSceneSize(element)
    const isSelected =
      selectedIdsRef.current.includes(id) || selectionPreviewIdsRef.current.includes(id)
    const isHovered = hoveredIdRef.current === id
    const outlineStrokeWidth = isSelected ? 2 : isHovered ? 4 : 0
    const visualNodes =
      node.getClassName() === 'Group'
        ? ((node as unknown as Konva.Group).find('.element-body') as unknown as Konva.Rect[])
        : ([node as Konva.Rect] as Konva.Rect[])
    const outlineNode =
      node.getClassName() === 'Group'
        ? ((node as unknown as Konva.Group).findOne('.element-outline') as Konva.Rect | null)
        : null
    if (visualNodes.length === 0) {
      return
    }

    if (element.type === 'parking') {
      const parkingParams = normalizeParkingParams(element.params as ParkingParams)
      const parkingCount = parkingParams.slots.length
      const slotWidth = elementSize.width / parkingCount
      visualNodes.forEach((visualNode) => {
        visualNode.setAttrs({
          shadowBlur: 0,
          shadowColor: item.color,
          stroke: 'rgba(255, 255, 255, 0.4)',
          strokeWidth: 1,
          width: slotWidth,
          height: elementSize.height,
          offsetX: slotWidth / 2,
          offsetY: elementSize.height / 2,
        })
      })
      outlineNode?.setAttrs({
        stroke: ELEMENT_HOVER_OUTLINE,
        strokeWidth: outlineStrokeWidth,
        width: elementSize.width,
        height: elementSize.height,
        offsetX: elementSize.width / 2,
        offsetY: elementSize.height / 2,
      })
      elementsDisplayLayerRef.current?.batchDraw()
      recordPerf('selectMs', performance.now() - start)
      return
    }

    if (element.type === 'charger') {
      visualNodes[0].setAttrs({
        width: elementSize.width,
        height: elementSize.height,
        offsetX: elementSize.width / 2,
        offsetY: elementSize.height / 2,
      })
      outlineNode?.setAttrs({
        stroke: ELEMENT_HOVER_OUTLINE,
        strokeWidth: outlineStrokeWidth,
        width: elementSize.width,
        height: elementSize.height,
        offsetX: elementSize.width / 2,
        offsetY: elementSize.height / 2,
      })
      elementsDisplayLayerRef.current?.batchDraw()
      recordPerf('selectMs', performance.now() - start)
      return
    }

    visualNodes[0].setAttrs({
      shadowBlur: 0,
      shadowColor: item.color,
      stroke: '#ffffff',
      strokeWidth: 2,
      width: elementSize.width,
      height: elementSize.height,
      offsetX: elementSize.width / 2,
      offsetY: elementSize.height / 2,
    })
    outlineNode?.setAttrs({
      stroke: ELEMENT_HOVER_OUTLINE,
      strokeWidth: outlineStrokeWidth,
      width: elementSize.width,
      height: elementSize.height,
      offsetX: elementSize.width / 2,
      offsetY: elementSize.height / 2,
    })
    elementsDisplayLayerRef.current?.batchDraw()
    recordPerf('selectMs', performance.now() - start)
  }

  function setHoveredElement(id: string | null) {
    if (hoveredIdRef.current === id) {
      return
    }
    const previousId = hoveredIdRef.current
    hoveredIdRef.current = id
    applyElementVisualState(previousId)
    applyElementVisualState(id)
  }

  function applyViewport(nextViewport: Viewport) {
    const start = performance.now()
    const previousScale = viewportRef.current.scale
    viewportRef.current = nextViewport

    tilesDisplayGroupRef.current?.setAttrs({
      x: nextViewport.x,
      y: nextViewport.y,
      scaleX: nextViewport.scale,
      scaleY: nextViewport.scale,
    })
    elementsDisplayGroupRef.current?.setAttrs({
      x: nextViewport.x,
      y: nextViewport.y,
      scaleX: nextViewport.scale,
      scaleY: nextViewport.scale,
    })
    elementsHitGroupRef.current?.setAttrs({
      x: nextViewport.x,
      y: nextViewport.y,
      scaleX: nextViewport.scale,
      scaleY: nextViewport.scale,
    })

    updateGridOverlay(nextViewport)
    updateMultiSelectedOutline(nextViewport)
    updateSelectedLabel(nextViewport)
    if (Math.abs(previousScale - nextViewport.scale) > 0.0001) {
      setZoomPercent(Math.round(nextViewport.scale * 100))
    }
    drawLayers()
    recordPerf(isPanningRef.current ? 'panMs' : 'zoomMs', performance.now() - start)
  }

  function commitViewport(nextViewport: Viewport) {
    pendingViewportRef.current = nextViewport

    if (frameRef.current !== null) {
      return
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      if (!pendingViewportRef.current) {
        return
      }
      const viewportToApply = pendingViewportRef.current
      pendingViewportRef.current = null
      applyViewport(viewportToApply)
    })
  }

  function cancelPendingViewportWork() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pendingViewportRef.current = null
  }

  function getPointerWorldPosition() {
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer) {
      return null
    }
    return {
      x: (pointer.x - viewportRef.current.x) / viewportRef.current.scale,
      y: (pointer.y - viewportRef.current.y) / viewportRef.current.scale,
    }
  }

  function getWorldPositionFromClient(clientX: number, clientY: number) {
    const container = containerRef.current
    if (!container) {
      return null
    }
    const rect = container.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale,
      y: (clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale,
    }
  }

  function getViewportCenterWorldPosition() {
    return {
      x: (surfaceSize.width / 2 - viewportRef.current.x) / viewportRef.current.scale,
      y: (surfaceSize.height / 2 - viewportRef.current.y) / viewportRef.current.scale,
    }
  }

  function beginSelection(append: boolean) {
    const point = getPointerWorldPosition()
    if (!point) {
      return
    }

    didSelectionRef.current = false
    setSelectionDraft({
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
      append,
    })
  }

  function mergeSelectionIds(ids: string[]) {
    return Array.from(new Set([...selectedIdsRef.current, ...ids]))
  }

  function finalizeSelection(selection: SelectionDraft) {
    const normalizedSelection = {
      minX: Math.min(selection.startX, selection.endX),
      minY: Math.min(selection.startY, selection.endY),
      maxX: Math.max(selection.startX, selection.endX),
      maxY: Math.max(selection.startY, selection.endY),
    }

    const pickedIds = currentScene.elements
      .filter((element) =>
        doBoundsIntersect(
          normalizedSelection,
          getElementBounds(element, getElementSceneSize(element)),
        ),
      )
      .map((element) => element.id)

    didSelectionRef.current = true
    perfRef.current.selectCount += 1
    const start = performance.now()
    if (pickedIds.length === 0) {
      if (!selection.append) {
        selectElement(null)
      }
    } else {
      selectElements(selection.append ? mergeSelectionIds(pickedIds) : pickedIds)
    }
    perfRef.current.selectMs = Number((performance.now() - start).toFixed(2))
  }

  function updateDragPreview(clientX: number, clientY: number, type: ElementType) {
    const point = getWorldPositionFromClient(clientX, clientY)
    if (!point) {
      return
    }
    setDragPreview({
      type,
      x: point.x,
      y: point.y,
    })
  }

  function getTileCellFromPoint(point: { x: number; y: number }) {
    return {
      col: Math.floor(point.x / cellSize),
      row: Math.floor(point.y / cellSize),
    }
  }

  function applyGroundCellAtPoint(point: { x: number; y: number }) {
    const cell = getTileCellFromPoint(point)
    const key = `${cell.col}:${cell.row}`
    if (
      brushedGroundCellsRef.current.has(key) ||
      queuedGroundCellsRef.current.has(key)
    ) {
      return
    }

    brushedGroundCellsRef.current.add(key)
    queuedGroundCellsRef.current.set(key, cell)

    if (groundBrushFrameRef.current !== null) {
      return
    }

    groundBrushFrameRef.current = window.requestAnimationFrame(() => {
      groundBrushFrameRef.current = null
      if (queuedGroundCellsRef.current.size === 0) {
        return
      }
      const cells = Array.from(queuedGroundCellsRef.current.values())
      queuedGroundCellsRef.current.clear()
      applyTiles(cells, groundEditAction)
    })
  }

  function applyGroundSelection(selection: SelectionDraft) {
    const minCol = Math.floor(Math.min(selection.startX, selection.endX) / cellSize)
    const maxCol = Math.floor(Math.max(selection.startX, selection.endX) / cellSize)
    const minRow = Math.floor(Math.min(selection.startY, selection.endY) / cellSize)
    const maxRow = Math.floor(Math.max(selection.startY, selection.endY) / cellSize)
    const cells: Array<{ col: number; row: number }> = []

    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        cells.push({ col, row })
      }
    }

    applyTiles(cells, groundEditAction)
  }

  function beginElementsDrag(
    ids: string[],
    bounds: Bounds,
    positions: Record<string, { x: number; y: number }>,
    pointerStart: { x: number; y: number },
  ) {
    multiDragOriginRef.current = {
      ids,
      bounds,
      positions,
      pointerStart,
    }
  }

  function beginMultiSelectionDrag() {
    if (!selectedBounds || selectedOverlayIds.length < 2) {
      return
    }

    const pointer = getPointerWorldPosition()
    if (!pointer) {
      return
    }

    beginElementsDrag(
      selectedOverlayIds,
      selectedBounds,
      Object.fromEntries(
        selectedOverlayIds
          .map((id) => currentScene.elements.find((element) => element.id === id))
          .filter((element): element is (typeof currentScene.elements)[number] => !!element)
          .map((element) => [element.id, { x: element.x, y: element.y }]),
      ),
      pointer,
    )
  }

  function previewMultiSelectionDrag(deltaX: number, deltaY: number) {
    if (!multiDragOriginRef.current) {
      return
    }

    for (const id of multiDragOriginRef.current.ids) {
      const origin = multiDragOriginRef.current.positions[id]
      const displayNode = elementNodeMapRef.current[id]
      const hitNode = elementHitNodeMapRef.current[id]
      if (origin && displayNode) {
        displayNode.position({
          x: origin.x + deltaX,
          y: origin.y + deltaY,
        })
      }
      if (origin && hitNode) {
        hitNode.position({
          x: origin.x + deltaX,
          y: origin.y + deltaY,
        })
      }
    }
    elementsDisplayLayerRef.current?.batchDraw()
  }

  function endMultiSelectionDrag(deltaX: number, deltaY: number) {
    if (!multiDragOriginRef.current) {
      return
    }

    moveElementsBy(multiDragOriginRef.current.ids, deltaX, deltaY)
    multiDragOriginRef.current = null
    altCloneSourceRef.current = null
    altCloneOriginalPositionsRef.current = {}
  }

  function duplicateElementsForDrag(sourceElements: SceneElement[]) {
    if (sourceElements.length === 0) {
      return false
    }

    const pointer = getPointerWorldPosition()
    if (!pointer) {
      return false
    }

    const sourceBounds = sourceElements
      .map((element) => getElementBounds(element, getElementSceneSize(element)))
      .reduce<Bounds>(
        (accumulator, bounds) => ({
          minX: Math.min(accumulator.minX, bounds.minX),
          minY: Math.min(accumulator.minY, bounds.minY),
          maxX: Math.max(accumulator.maxX, bounds.maxX),
          maxY: Math.max(accumulator.maxY, bounds.maxY),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      )
    const centerX = (sourceBounds.minX + sourceBounds.maxX) / 2
    const centerY = (sourceBounds.minY + sourceBounds.maxY) / 2
    altCloneOriginalPositionsRef.current = Object.fromEntries(
      sourceElements.map((element) => [element.id, { x: element.x, y: element.y }]),
    )
    const duplicatedIds = insertElementsAt(cloneSceneElements(sourceElements), centerX, centerY)
    if (duplicatedIds.length === 0) {
      return false
    }

    const nextScene = useEditorStore.getState().scene
    if (!nextScene) {
      return false
    }

    beginElementsDrag(
      duplicatedIds,
      sourceBounds,
      Object.fromEntries(
        duplicatedIds
          .map((id) => nextScene.elements.find((element) => element.id === id))
          .filter((element): element is (typeof nextScene.elements)[number] => !!element)
          .map((element) => [element.id, { x: element.x, y: element.y }]),
      ),
      pointer,
    )
    altCloneSourceRef.current = pointer
    return true
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      setSurfaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!surfaceSize.width || !surfaceSize.height) {
      return
    }
    if (initializedSceneRef.current === scene.meta.id) {
      return
    }

    const nextViewport = {
      x: surfaceSize.width / 2 - currentScene.canvas.width / 2,
      y: surfaceSize.height / 2 - currentScene.canvas.height / 2,
      scale: 1,
    }
    viewportRef.current = nextViewport
    initializedSceneRef.current = currentScene.meta.id
    window.requestAnimationFrame(() => {
      applyViewport(nextViewport)
    })
  }, [currentScene.canvas.height, currentScene.canvas.width, currentScene.meta.id, surfaceSize.height, surfaceSize.width])

  useEffect(() => {
    const handleAddAtViewportCenter = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: ElementType }>
      const point = getViewportCenterWorldPosition()
      addElementAt(customEvent.detail.type, point.x, point.y)
    }

    window.addEventListener('catalog-add-at-viewport-center', handleAddAtViewportCenter)
    return () => {
      window.removeEventListener(
        'catalog-add-at-viewport-center',
        handleAddAtViewportCenter,
      )
    }
  }, [addElementAt, surfaceSize.height, surfaceSize.width])

  useEffect(() => {
    const loop = (time: number) => {
      frameStatsRef.current.frames += 1
      if (time - frameStatsRef.current.lastTime >= 500) {
        perfRef.current.fps = Math.round(
          (frameStatsRef.current.frames * 1000) / (time - frameStatsRef.current.lastTime),
        )
        frameStatsRef.current.frames = 0
        frameStatsRef.current.lastTime = time
        setPerfPanel({ ...perfRef.current })
      }
      perfLoopRef.current = window.requestAnimationFrame(loop)
    }

    perfLoopRef.current = window.requestAnimationFrame(loop)
    return () => {
      if (perfLoopRef.current !== null) {
        window.cancelAnimationFrame(perfLoopRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const clearPreview = () => setDragPreview(null)
    const handleCatalogDragStart = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: ElementType }>
      dragTypeRef.current = customEvent.detail.type
    }
    const handleCatalogDragEnd = () => {
      dragTypeRef.current = null
      setDragPreview(null)
    }

    window.addEventListener('dragend', clearPreview)
    window.addEventListener('drop', clearPreview)
    window.addEventListener('catalog-drag-start', handleCatalogDragStart)
    window.addEventListener('catalog-drag-end', handleCatalogDragEnd)

    return () => {
      window.removeEventListener('dragend', clearPreview)
      window.removeEventListener('drop', clearPreview)
      window.removeEventListener('catalog-drag-start', handleCatalogDragStart)
      window.removeEventListener('catalog-drag-end', handleCatalogDragEnd)
    }
  }, [])

  useEffect(() => {
    const previousIds = new Set(selectionPreviewIdsRef.current)
    const nextIds = new Set(selectionPreviewIds)
    const idsToRefresh = new Set([...previousIds, ...nextIds])

    selectionPreviewIdsRef.current = selectionPreviewIds
    idsToRefresh.forEach((id) => applyElementVisualState(id))
    elementsDisplayLayerRef.current?.batchDraw()
  }, [selectionPreviewIds])

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      const start = performance.now()
      const idsChanged =
        state.selectedIds.length !== previousState.selectedIds.length ||
        state.selectedIds.some((id, index) => id !== previousState.selectedIds[index])

      if (!idsChanged && state.selectedId === previousState.selectedId) {
        perfRef.current.storeMs = Number((performance.now() - start).toFixed(2))
        return
      }

      selectedIdRef.current = state.selectedId
      selectedIdsRef.current = state.selectedIds
      const idsToRefresh = new Set([...previousState.selectedIds, ...state.selectedIds])
      idsToRefresh.forEach((id) => applyElementVisualState(id))
      setSelectedOverlayIds(state.selectedIds)
      setSelectedOverlayId(state.selectedIds.length === 1 ? state.selectedId : null)
      elementsDisplayLayerRef.current?.batchDraw()
      perfRef.current.storeMs = Number((performance.now() - start).toFixed(2))
      perfRef.current.storeCount += 1
    })

    return unsubscribe
  }, [currentScene.elements])

  useEffect(() => {
    const validIds = new Set(currentScene.elements.map((element) => element.id))
    for (const id of Object.keys(elementNodeMapRef.current)) {
      if (!validIds.has(id)) {
        delete elementNodeMapRef.current[id]
      }
    }
    for (const id of Object.keys(elementHitNodeMapRef.current)) {
      if (!validIds.has(id)) {
        delete elementHitNodeMapRef.current[id]
      }
    }
  }, [currentScene.elements])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      refreshLayerCache()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      tilesDisplayGroupRef.current?.clearCache()
      elementsDisplayGroupRef.current?.clearCache()
    }
  }, [currentScene.elements, currentScene.tiles])

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      if (groundBrushFrameRef.current !== null) {
        window.cancelAnimationFrame(groundBrushFrameRef.current)
      }
      queuedGroundCellsRef.current.clear()
      brushedGroundCellsRef.current.clear()
      if (perfLoopRef.current !== null) {
        window.cancelAnimationFrame(perfLoopRef.current)
      }
      pendingViewportRef.current = null
      setZoomPercent(Math.round(viewportRef.current.scale * 100))
    },
    [],
  )

  function handleStageWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault()

    const currentViewport = viewportRef.current
    if (event.evt.altKey || event.evt.metaKey) {
      perfRef.current.wheelCount += 1
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      if (!pointer) {
        return
      }

      const direction = event.evt.deltaY > 0 ? -1 : 1
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, currentViewport.scale * (direction > 0 ? 1.1 : 0.9)),
      )
      const worldX = (pointer.x - currentViewport.x) / currentViewport.scale
      const worldY = (pointer.y - currentViewport.y) / currentViewport.scale

      commitViewport(
        {
          scale: nextScale,
          x: pointer.x - worldX * nextScale,
          y: pointer.y - worldY * nextScale,
        },
      )
      return
    }

    const delta = Math.sign(event.evt.deltaY || event.evt.deltaX || 0) * WHEEL_PAN_STEP
    if (delta === 0) {
      return
    }

    perfRef.current.wheelCount += 1
    if (event.evt.shiftKey) {
      commitViewport({
        ...currentViewport,
        x: currentViewport.x - delta,
      })
      return
    }

    commitViewport({
      ...currentViewport,
      y: currentViewport.y - delta,
    })
  }

  function handlePointerDown(event: Konva.KonvaEventObject<MouseEvent>) {
    if (measureMode && event.evt.button === 0) {
      const point = getPointerWorldPosition()
      if (!point) {
        return
      }
      event.evt.preventDefault()
      setMeasureDraft({
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
      })
      return
    }

    if (activeTileBrush && event.evt.button === 0) {
      if (groundEditMode === 'brush') {
        const point = getPointerWorldPosition()
        if (!point) {
          return
        }
        event.evt.preventDefault()
        isGroundBrushingRef.current = true
        brushedGroundCellsRef.current = new Set()
        applyGroundCellAtPoint(point)
        return
      }

      if (groundEditMode === 'marquee') {
        event.evt.preventDefault()
        beginSelection(false)
        return
      }
    }

    if (
      event.evt.button === 0 &&
      !activeTileBrush &&
      event.target.name() === 'canvas-hit-area'
    ) {
      beginSelection(event.evt.shiftKey)
      return
    }

    if (event.evt.button !== 1) {
      return
    }

    perfRef.current.panCount += 1
    event.evt.preventDefault()
    cancelPendingViewportWork()
    panStartRef.current = {
      x: event.evt.clientX,
      y: event.evt.clientY,
    }
    panOriginRef.current = {
      x: viewportRef.current.x,
      y: viewportRef.current.y,
    }
    isPanningRef.current = true
    didPanRef.current = false
  }

  function handlePointerMove(event: Konva.KonvaEventObject<MouseEvent>) {
    const pointer = getPointerWorldPosition()
    if (pointer) {
      lastPointerWorldRef.current = pointer
    }
    const stagePointer = stageRef.current?.getPointerPosition() ?? null

    if (activeTileBrush && groundEditMode === 'brush') {
      setGroundBrushPreview(stagePointer ? { x: stagePointer.x, y: stagePointer.y } : null)
    } else if (groundBrushPreview) {
      setGroundBrushPreview(null)
    }

    if (isGroundBrushingRef.current && pointer) {
      applyGroundCellAtPoint(pointer)
      return
    }

    if (measureDraft) {
      const point = pointer
      if (!point) {
        return
      }
      setMeasureDraft((current) =>
        current
          ? {
              ...current,
              endX: point.x,
              endY: point.y,
            }
          : current,
      )
      return
    }

    if (selectionDraft) {
      const point = pointer
      if (!point) {
        return
      }
      setSelectionDraft((current) =>
        current
          ? {
              ...current,
              endX: point.x,
              endY: point.y,
            }
          : current,
      )
      return
    }

    if (!isPanningRef.current || !panStartRef.current || !panOriginRef.current) {
      return
    }

    const deltaX = event.evt.clientX - panStartRef.current.x
    const deltaY = event.evt.clientY - panStartRef.current.y

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      didPanRef.current = true
    }

    applyViewport({
      x: panOriginRef.current.x + deltaX,
      y: panOriginRef.current.y + deltaY,
      scale: viewportRef.current.scale,
    })
  }

  function handlePointerUp() {
    isGroundBrushingRef.current = false
    if (groundBrushFrameRef.current !== null) {
      window.cancelAnimationFrame(groundBrushFrameRef.current)
      groundBrushFrameRef.current = null
    }
    if (queuedGroundCellsRef.current.size > 0) {
      const cells = Array.from(queuedGroundCellsRef.current.values())
      queuedGroundCellsRef.current.clear()
      applyTiles(cells, groundEditAction)
    }
    brushedGroundCellsRef.current = new Set()

    if (measureDraft) {
      setMeasureDraft(null)
      setMeasureMode(false)
      return
    }

    if (selectionDraft) {
      if (activeTileBrush && groundEditMode === 'marquee') {
        applyGroundSelection(selectionDraft)
        setSelectionDraft(null)
        return
      }
      finalizeSelection(selectionDraft)
      setSelectionDraft(null)
      return
    }

    isPanningRef.current = false
    panStartRef.current = null
    panOriginRef.current = null
    cancelPendingViewportWork()
    window.setTimeout(() => {
      didPanRef.current = false
    }, 0)
  }

  function handleCanvasClick(event?: Konva.KonvaEventObject<MouseEvent>) {
    if (event?.evt.button !== 0) {
      return
    }

    if (measureMode) {
      return
    }

    if (isPanningRef.current || didPanRef.current) {
      return
    }

    if (didSelectionRef.current) {
      didSelectionRef.current = false
      return
    }

    if (event?.evt.shiftKey) {
      return
    }

    if (activeTileBrush) {
      if (groundEditMode !== 'point') {
        return
      }
    } else if (selectedIdsRef.current.length === 0) {
      return
    }

    const point = getPointerWorldPosition()
    if (!point) {
      return
    }

    if (activeTileBrush) {
      applyTiles([getTileCellFromPoint(point)], groundEditAction)
      return
    }

    perfRef.current.selectCount += 1
    const start = performance.now()
    selectElement(null)
    perfRef.current.selectMs = Number((performance.now() - start).toFixed(2))
  }

  function getGridOverlayStyle(nextViewport: Viewport) {
    const unitsPerMeter = getUnitsPerMeter(currentScene.canvas.unitsPerMeter)
    const unitGridSizePx = nextViewport.scale
    const meterGridSizePx = unitsPerMeter * nextViewport.scale
    const majorGridSizePx = meterGridSizePx * 5
    const unitGridOffsetX =
      ((nextViewport.x % unitGridSizePx) + unitGridSizePx) % unitGridSizePx
    const unitGridOffsetY =
      ((nextViewport.y % unitGridSizePx) + unitGridSizePx) % unitGridSizePx
    const meterGridOffsetX =
      ((nextViewport.x % meterGridSizePx) + meterGridSizePx) % meterGridSizePx
    const meterGridOffsetY =
      ((nextViewport.y % meterGridSizePx) + meterGridSizePx) % meterGridSizePx
    const majorGridOffsetX =
      ((nextViewport.x % majorGridSizePx) + majorGridSizePx) % majorGridSizePx
    const majorGridOffsetY =
      ((nextViewport.y % majorGridSizePx) + majorGridSizePx) % majorGridSizePx
    const showUnitGrid = unitGridSizePx >= 2
    const showMeterGrid = meterGridSizePx >= 8

    return {
      backgroundColor: '#1b1b1b',
      backgroundImage: showUnitGrid
        ? [
            'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          ].join(', ')
        : showMeterGrid
          ? [
              'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
              'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            ].join(', ')
          : [
              'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            ].join(', '),
      backgroundPosition: showUnitGrid
        ? [
            `${unitGridOffsetX}px 0px`,
            `0px ${unitGridOffsetY}px`,
            `${meterGridOffsetX}px 0px`,
            `0px ${meterGridOffsetY}px`,
            `${majorGridOffsetX}px 0px`,
            `0px ${majorGridOffsetY}px`,
          ].join(', ')
        : showMeterGrid
          ? [
              `${meterGridOffsetX}px 0px`,
              `0px ${meterGridOffsetY}px`,
              `${majorGridOffsetX}px 0px`,
              `0px ${majorGridOffsetY}px`,
            ].join(', ')
          : [`${majorGridOffsetX}px 0px`, `0px ${majorGridOffsetY}px`].join(', '),
      backgroundSize: showUnitGrid
        ? [
            `${unitGridSizePx}px ${unitGridSizePx}px`,
            `${unitGridSizePx}px ${unitGridSizePx}px`,
            `${meterGridSizePx}px ${meterGridSizePx}px`,
            `${meterGridSizePx}px ${meterGridSizePx}px`,
            `${majorGridSizePx}px ${majorGridSizePx}px`,
            `${majorGridSizePx}px ${majorGridSizePx}px`,
          ].join(', ')
        : showMeterGrid
          ? [
              `${meterGridSizePx}px ${meterGridSizePx}px`,
              `${meterGridSizePx}px ${meterGridSizePx}px`,
              `${majorGridSizePx}px ${majorGridSizePx}px`,
              `${majorGridSizePx}px ${majorGridSizePx}px`,
            ].join(', ')
          : [
              `${majorGridSizePx}px ${majorGridSizePx}px`,
              `${majorGridSizePx}px ${majorGridSizePx}px`,
            ].join(', '),
    }
  }

  function updateGridOverlay(nextViewport: Viewport) {
    const gridOverlay = gridOverlayRef.current
    if (!gridOverlay) {
      return
    }
    const styles = getGridOverlayStyle(nextViewport)
    gridOverlay.style.backgroundColor = styles.backgroundColor
    gridOverlay.style.backgroundImage = styles.backgroundImage
    gridOverlay.style.backgroundPosition = styles.backgroundPosition
    gridOverlay.style.backgroundSize = styles.backgroundSize
  }

  function formatMeters(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
  }

  function updateSelectedLabel(nextViewport: Viewport = viewportRef.current) {
    const layer = selectedLabelLayerRef.current
    const group = selectedLabelGroupRef.current
    const rect = selectedLabelRectRef.current
    const text = selectedLabelTextRef.current

    if (!layer || !group || !rect || !text) {
      return
    }

    const selectedLabel = getSelectedLabelMetrics(nextViewport)
    if (!selectedLabel) {
      group.visible(false)
      layer.batchDraw()
      return
    }

    group.visible(true)
    group.position({ x: selectedLabel.x, y: selectedLabel.y })
    rect.size({ width: selectedLabel.width, height: selectedLabel.height })
    text.setAttrs({
      text: selectedLabel.labelText,
      width: selectedLabel.width - SELECTED_LABEL_PADDING_X * 2,
      height: SELECTED_LABEL_FONT_SIZE * SELECTED_LABEL_LINE_HEIGHT,
      x: SELECTED_LABEL_PADDING_X,
      y: SELECTED_LABEL_PADDING_Y,
    })
    layer.batchDraw()
  }

  function updateMultiSelectedOutline(nextViewport: Viewport = viewportRef.current) {
    const layer = multiSelectedOutlineLayerRef.current
    const group = multiSelectedOutlineGroupRef.current
    const rect = multiSelectedOutlineRectRef.current

    if (!layer || !group || !rect) {
      return
    }

    if (!selectedBounds) {
      group.visible(false)
      layer.batchDraw()
      return
    }

    group.visible(true)
    group.setAttrs({
      x: nextViewport.x,
      y: nextViewport.y,
      scaleX: nextViewport.scale,
      scaleY: nextViewport.scale,
    })
    rect.setAttrs({
      x: selectedBounds.minX,
      y: selectedBounds.minY,
      width: selectedBounds.maxX - selectedBounds.minX,
      height: selectedBounds.maxY - selectedBounds.minY,
    })
    layer.batchDraw()
  }

  function getSelectedLabelMetrics(nextViewport: Viewport) {
    if (selectedBounds && selectedOverlayIds.length > 1) {
      const unitsPerMeter = getUnitsPerMeter(currentScene.canvas.unitsPerMeter)
      const widthM = (selectedBounds.maxX - selectedBounds.minX) / unitsPerMeter
      const heightM = (selectedBounds.maxY - selectedBounds.minY) / unitsPerMeter
      const labelText = `长:${formatMeters(heightM)}m 宽:${formatMeters(widthM)}m`
      const left = nextViewport.x + selectedBounds.minX * nextViewport.scale
      const right = nextViewport.x + selectedBounds.maxX * nextViewport.scale
      const bottom = nextViewport.y + selectedBounds.maxY * nextViewport.scale
      const textWidth = measureSelectedLabelTextWidth(labelText)
      const width = textWidth + SELECTED_LABEL_PADDING_X * 2
      const height =
        SELECTED_LABEL_FONT_SIZE * SELECTED_LABEL_LINE_HEIGHT + SELECTED_LABEL_PADDING_Y * 2

      return {
        labelText,
        x: (left + right) / 2 - width / 2,
        y: bottom + SELECTED_LABEL_GAP,
        width,
        height,
      }
    }

    if (!selectedElement) {
      return null
    }

    const meterSize = getElementMeterSize(selectedElement, currentScene.canvas.unitsPerMeter)
    const labelText = `长:${formatMeters(meterSize.height)}m 宽:${formatMeters(meterSize.width)}m`
    const elementSize = getElementSceneSize(selectedElement)
    const radians = (selectedElement.rotation * Math.PI) / 180
    const scaledWidth = elementSize.width * nextViewport.scale
    const scaledHeight = elementSize.height * nextViewport.scale
    const bboxHeight =
      Math.abs(scaledWidth * Math.sin(radians)) + Math.abs(scaledHeight * Math.cos(radians))
    const centerX = nextViewport.x + selectedElement.x * nextViewport.scale
    const centerY = nextViewport.y + selectedElement.y * nextViewport.scale
    const textWidth = measureSelectedLabelTextWidth(labelText)
    const width = textWidth + SELECTED_LABEL_PADDING_X * 2
    const height =
      SELECTED_LABEL_FONT_SIZE * SELECTED_LABEL_LINE_HEIGHT + SELECTED_LABEL_PADDING_Y * 2

    return {
      labelText,
      x: centerX - width / 2,
      y: centerY + bboxHeight / 2 + SELECTED_LABEL_GAP,
      width,
      height,
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.isContentEditable

      if (isEditableTarget || !selectedId) {
        if (
          isEditableTarget ||
          (!(event.ctrlKey || event.metaKey) && event.key !== 'Delete' && event.key !== 'Backspace')
        ) {
          return
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        if (selectedIdsRef.current.length === 0) {
          return
        }
        event.preventDefault()
        clipboardRef.current = {
          elements: cloneSceneElements(
            currentScene.elements.filter((element) => selectedIdsRef.current.includes(element.id)),
          ),
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        if (!clipboardRef.current || clipboardRef.current.elements.length === 0) {
          return
        }
        event.preventDefault()
        const targetPoint = lastPointerWorldRef.current ?? getViewportCenterWorldPosition()
        insertElementsAt(
          cloneSceneElements(clipboardRef.current.elements),
          targetPoint.x,
          targetPoint.y,
        )
        return
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIdsRef.current.length === 0) {
          return
        }
        event.preventDefault()
        deleteSelectedElement()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentScene.elements, deleteSelectedElement, insertElementsAt, selectedId, undo])

  useEffect(() => {
    updateGridOverlay(viewportRef.current)
    updateMultiSelectedOutline(viewportRef.current)
    updateSelectedLabel(viewportRef.current)
  }, [
    currentScene.canvas.unitsPerMeter,
    currentScene.elements,
    selectedBounds,
    selectedOverlayId,
    selectedOverlayIds,
    showGrid,
  ])

  const measureDistance =
    measureDraft === null
      ? null
      : Math.hypot(
          measureDraft.endX - measureDraft.startX,
          measureDraft.endY - measureDraft.startY,
        ) / getUnitsPerMeter(currentScene.canvas.unitsPerMeter)
  const measureMidpoint =
    measureDraft === null
      ? null
      : {
          x: (measureDraft.startX + measureDraft.endX) / 2,
          y: (measureDraft.startY + measureDraft.endY) / 2,
        }

  return (
    <div className="canvas-wrap">
      <div
        className="canvas-surface"
        ref={containerRef}
        onDragEnter={(event) => {
          const type = dragTypeRef.current ?? readDraggedElementType(event.dataTransfer)
          if (!type) {
            return
          }
          event.preventDefault()
          updateDragPreview(event.clientX, event.clientY, type)
        }}
        onDragOver={(event) => {
          const type = dragTypeRef.current ?? readDraggedElementType(event.dataTransfer)
          if (!type) {
            return
          }
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          lastPointerWorldRef.current = getWorldPositionFromClient(event.clientX, event.clientY)
          updateDragPreview(event.clientX, event.clientY, type)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return
          }
          setDragPreview(null)
        }}
        onDrop={(event) => {
          const type = dragTypeRef.current ?? readDraggedElementType(event.dataTransfer)
          if (!type) {
            return
          }
          event.preventDefault()
          const point = getWorldPositionFromClient(event.clientX, event.clientY)
          lastPointerWorldRef.current = point
          dragTypeRef.current = null
          setDragPreview(null)
          if (!point) {
            return
          }
          addElementAt(type, point.x, point.y)
        }}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          cursor: measureMode ? 'crosshair' : isPanningRef.current ? 'grabbing' : 'default',
        }}
      >
          <div
          className="canvas-grid-overlay"
          ref={gridOverlayRef}
          style={{ display: showGrid ? 'block' : 'none' }}
        />
        <Stage
          ref={stageRef}
          height={surfaceSize.height}
          width={surfaceSize.width}
          onContextMenu={(event) => event.evt.preventDefault()}
          onMouseDown={handlePointerDown}
          onMouseLeave={handlePointerUp}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onWheel={handleStageWheel}
        >
          <Layer>
            <Rect
              fill="transparent"
              height={surfaceSize.height}
              listening={false}
              width={surfaceSize.width}
            />
            <Rect
              fill="transparent"
              height={surfaceSize.height}
              name="canvas-hit-area"
              width={surfaceSize.width}
              onClick={handleCanvasClick}
            />
          </Layer>

          {dragPreview && (
            <Layer listening={false}>
              <Group
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                x={viewport.x}
                y={viewport.y}
              >
                {(() => {
                  const item = getCatalogItem(dragPreview.type)
                  if (dragPreview.type === 'charger' && chargerPreviewImage) {
                    return (
                      <KonvaImage
                        height={52}
                        image={chargerPreviewImage}
                        offsetX={26}
                        offsetY={26}
                        opacity={0.72}
                        width={52}
                        x={dragPreview.x}
                        y={dragPreview.y}
                      />
                    )
                  }

                  if (dragPreview.type === 'parking' && parkingPreviewImage) {
                    return (
                      <KonvaImage
                        height={52}
                        image={parkingPreviewImage}
                        offsetX={26}
                        offsetY={26}
                        opacity={0.72}
                        width={52}
                        x={dragPreview.x}
                        y={dragPreview.y}
                      />
                    )
                  }

                  if (dragPreview.type === 'storage') {
                    if (storagePreviewImage) {
                      return (
                        <KonvaImage
                          height={52}
                          image={storagePreviewImage}
                          offsetX={26}
                          offsetY={26}
                          opacity={0.72}
                          width={52}
                          x={dragPreview.x}
                          y={dragPreview.y}
                        />
                      )
                    }
                  }

                  return (
                    <Rect
                      cornerRadius={8}
                      fill={item.color}
                      height={52}
                      offsetX={26}
                      offsetY={26}
                      opacity={0.55}
                      width={52}
                      x={dragPreview.x}
                      y={dragPreview.y}
                    />
                  )
                })()}
              </Group>
            </Layer>
          )}

          {selectionDraft && (
            <Layer listening={false}>
              <Group
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                x={viewport.x}
                y={viewport.y}
              >
                <Rect
                  fill="rgba(70, 122, 247, 0.3)"
                  height={Math.abs(selectionDraft.endY - selectionDraft.startY)}
                  stroke={ELEMENT_HOVER_OUTLINE}
                  strokeScaleEnabled={false}
                  strokeWidth={4}
                  width={Math.abs(selectionDraft.endX - selectionDraft.startX)}
                  x={Math.min(selectionDraft.startX, selectionDraft.endX)}
                  y={Math.min(selectionDraft.startY, selectionDraft.endY)}
                />
              </Group>
            </Layer>
          )}

          {activeTileBrush && groundEditMode === 'brush' && groundBrushPreview && (
            <Layer listening={false}>
              <Circle
                x={groundBrushPreview.x}
                y={groundBrushPreview.y}
                radius={10}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={1}
              />
            </Layer>
          )}

          <FastLayer ref={tilesDisplayLayerRef}>
            <Group
              ref={tilesDisplayGroupRef}
              listening={false}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              x={viewport.x}
              y={viewport.y}
            >
              {tileBatches.map((batch) => (
                <Shape
                  key={batch.tileType}
                  fill={batch.fill}
                  listening={false}
                  opacity={0.8}
                  perfectDrawEnabled={false}
                  sceneFunc={(context, shape) => {
                    context.beginPath()
                    batch.tiles.forEach((tile) => {
                      context.rect(tile.x, tile.y, cellSize, cellSize)
                    })
                    context.fillStrokeShape(shape)
                  }}
                />
              ))}
            </Group>
          </FastLayer>

          <Layer ref={elementsDisplayLayerRef}>
            <Group
              ref={elementsDisplayGroupRef}
              listening={false}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              x={viewport.x}
              y={viewport.y}
            >
              {currentScene.elements.map((element) => {
                const item = getCatalogItem(element.type)
                const elementSize = getElementSceneSize(element)
                const isSelected =
                  selectedIdsRef.current.includes(element.id) ||
                  selectionPreviewIdsRef.current.includes(element.id)
                if (element.type === 'parking') {
                  const parkingParams = normalizeParkingParams(element.params as ParkingParams)
                  const parkingCount = parkingParams.slots.length
                  const slotWidth = elementSize.width / parkingCount
                  return (
                    <Group
                      key={element.id}
                      ref={(node) => {
                        elementNodeMapRef.current[element.id] = node
                      }}
                      rotation={element.rotation}
                      x={element.x}
                      y={element.y}
                    >
                      <Rect
                        name="element-outline"
                        cornerRadius={0}
                        fillEnabled={false}
                        height={elementSize.height}
                        listening={false}
                        offsetX={elementSize.width / 2}
                        offsetY={elementSize.height / 2}
                        stroke={ELEMENT_HOVER_OUTLINE}
                        strokeScaleEnabled={false}
                        strokeWidth={isSelected ? 2 : 0}
                        width={elementSize.width}
                      />
                      {parkingParams.slots.map((slot) => {
                        const centerOffset =
                          -elementSize.width / 2 + slotWidth * slot.index + slotWidth / 2
                        return (
                          <Rect
                            key={slot.id}
                            name="element-body"
                            cornerRadius={0}
                            fill={item.color}
                            height={elementSize.height}
                            offsetX={slotWidth / 2}
                            offsetY={elementSize.height / 2}
                            opacity={1}
                            perfectDrawEnabled={false}
                            shadowForStrokeEnabled={false}
                            shadowBlur={0}
                            shadowColor={item.color}
                            stroke="rgba(255, 255, 255, 0.4)"
                            strokeScaleEnabled={false}
                            strokeWidth={1}
                            width={slotWidth}
                            x={centerOffset}
                            y={0}
                          />
                        )
                      })}
                    </Group>
                  )
                }

                return (
                  <Group
                    key={element.id}
                    ref={(node) => {
                      elementNodeMapRef.current[element.id] = node
                    }}
                    rotation={element.rotation}
                    x={element.x}
                    y={element.y}
                  >
                    {element.type === 'charger' && chargerCanvasImage ? (
                      <>
                        <KonvaImage
                          height={elementSize.height}
                          image={chargerCanvasImage}
                          listening={false}
                          offsetX={elementSize.width / 2}
                          offsetY={elementSize.height / 2}
                          width={elementSize.width}
                        />
                        <Rect
                          name="element-body"
                          fillEnabled={false}
                          height={elementSize.height}
                          listening={false}
                          offsetX={elementSize.width / 2}
                          offsetY={elementSize.height / 2}
                          strokeEnabled={false}
                          width={elementSize.width}
                        />
                      </>
                    ) : element.type === 'storage' &&
                      (normalizeStorageModel((element.params as StorageParams).model) ===
                      'storage_418'
                        ? storage418Image
                        : storage261Image) ? (
                      <>
                        <KonvaImage
                          height={elementSize.height}
                          image={
                            normalizeStorageModel((element.params as StorageParams).model) ===
                            'storage_418'
                              ? storage418Image ?? undefined
                              : storage261Image ?? undefined
                          }
                          listening={false}
                          offsetX={elementSize.width / 2}
                          offsetY={elementSize.height / 2}
                          width={elementSize.width}
                        />
                        <Rect
                          name="element-body"
                          fillEnabled={false}
                          height={elementSize.height}
                          listening={false}
                          offsetX={elementSize.width / 2}
                          offsetY={elementSize.height / 2}
                          strokeEnabled={false}
                          width={elementSize.width}
                        />
                      </>
                    ) : (
                      <Rect
                        name="element-body"
                        cornerRadius={14}
                        fill={item.color}
                        height={elementSize.height}
                        offsetX={elementSize.width / 2}
                        offsetY={elementSize.height / 2}
                        opacity={0.9}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        shadowBlur={0}
                        shadowColor={item.color}
                        stroke="#ffffff"
                        strokeScaleEnabled={false}
                        strokeWidth={2}
                        width={elementSize.width}
                      />
                    )}
                    <Rect
                      name="element-outline"
                      cornerRadius={0}
                      fillEnabled={false}
                      height={elementSize.height}
                      listening={false}
                      offsetX={elementSize.width / 2}
                      offsetY={elementSize.height / 2}
                      stroke={ELEMENT_HOVER_OUTLINE}
                      strokeScaleEnabled={false}
                      strokeWidth={isSelected ? 2 : 0}
                      width={elementSize.width}
                    />
                  </Group>
                )
              })}
            </Group>
          </Layer>

          <Layer listening={false} ref={multiSelectedOutlineLayerRef}>
            <Group ref={multiSelectedOutlineGroupRef} visible={false}>
              <Rect
                ref={multiSelectedOutlineRectRef}
                fillEnabled={false}
                stroke={ELEMENT_HOVER_OUTLINE}
                strokeScaleEnabled={false}
                strokeWidth={2}
              />
            </Group>
          </Layer>

          {selectedBounds && selectedOverlayIds.length > 1 && (
            <Layer>
              <Group
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                x={viewport.x}
                y={viewport.y}
              >
                <Rect
                  draggable={!measureMode}
                  fill="rgba(0,0,0,0.001)"
                  height={selectedBounds.maxY - selectedBounds.minY}
                  width={selectedBounds.maxX - selectedBounds.minX}
                  x={selectedBounds.minX}
                  y={selectedBounds.minY}
                  onClick={() => {
                    if (selectedOverlayIds.length > 0) {
                      selectElements(selectedOverlayIds)
                    }
                  }}
                  onDragStart={(event) => {
                    if (event.evt.button !== 0 || !selectedBounds) {
                      event.target.stopDrag()
                      return
                    }
                    if (event.evt.altKey) {
                      const sourceElements = currentScene.elements.filter((element) =>
                        selectedOverlayIds.includes(element.id),
                      )
                      if (!duplicateElementsForDrag(sourceElements)) {
                        event.target.stopDrag()
                        return
                      }
                      return
                    }
                    beginMultiSelectionDrag()
                  }}
                  onDragMove={(event) => {
                    if (event.evt.button !== 0 || !multiDragOriginRef.current) {
                      event.target.stopDrag()
                      return
                    }
                    const pointer = getPointerWorldPosition()
                    if (!pointer) {
                      return
                    }
                    const deltaX = pointer.x - multiDragOriginRef.current.pointerStart.x
                    const deltaY = pointer.y - multiDragOriginRef.current.pointerStart.y
                    previewMultiSelectionDrag(deltaX, deltaY)
                  }}
                  onDragEnd={(event) => {
                    const origin = multiDragOriginRef.current
                    if (!origin) {
                      return
                    }
                    const pointer = getPointerWorldPosition()
                    if (!pointer) {
                      multiDragOriginRef.current = null
                      altCloneSourceRef.current = null
                      altCloneOriginalPositionsRef.current = {}
                      return
                    }
                    const deltaX = pointer.x - origin.pointerStart.x
                    const deltaY = pointer.y - origin.pointerStart.y
                    endMultiSelectionDrag(deltaX, deltaY)
                    event.target.position({
                      x: origin.bounds.minX,
                      y: origin.bounds.minY,
                    })
                  }}
                />
              </Group>
            </Layer>
          )}

          <Layer>
            <Group
              ref={elementsHitGroupRef}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              x={viewport.x}
              y={viewport.y}
            >
              {currentScene.elements.map((element) => {
                const elementSize = getElementSceneSize(element)
                return (
                  <Rect
                    key={`element-hit-${element.id}`}
                    ref={(node) => {
                      elementHitNodeMapRef.current[element.id] = node
                    }}
                    draggable={!measureMode && !activeTileBrush}
                    fill="rgba(0,0,0,0.001)"
                    height={elementSize.height}
                    offsetX={elementSize.width / 2}
                    offsetY={elementSize.height / 2}
                    rotation={element.rotation}
                    width={elementSize.width}
                    x={element.x}
                    y={element.y}
                    onClick={(event) => {
                      if (activeTileBrush) {
                        return
                      }
                      if (measureMode) {
                        return
                      }
                      if (event.evt.shiftKey) {
                        if (!selectedIdsRef.current.includes(element.id)) {
                          selectElements(mergeSelectionIds([element.id]))
                        }
                        return
                      }
                      if (
                        selectedIdsRef.current.length !== 1 ||
                        selectedIdRef.current !== element.id
                      ) {
                        selectElement(element.id)
                      }
                    }}
                    onMouseEnter={() => {
                      if (!activeTileBrush) {
                        setHoveredElement(element.id)
                      }
                    }}
                    onMouseLeave={() => setHoveredElement(null)}
                    onDragStart={(event) => {
                      if (activeTileBrush) {
                        event.target.stopDrag()
                        return
                      }
                      if (event.evt.button !== 0) {
                        event.target.stopDrag()
                        const displayNode = elementNodeMapRef.current[element.id]
                        if (displayNode) {
                          displayNode.position({
                            x: element.x,
                            y: element.y,
                          })
                        }
                        elementsDisplayLayerRef.current?.batchDraw()
                        return
                      }

                      if (
                        selectedIdsRef.current.length > 1 &&
                        selectedIdsRef.current.includes(element.id)
                      ) {
                        if (event.evt.altKey) {
                          const sourceElements = currentScene.elements.filter((item) =>
                            selectedIdsRef.current.includes(item.id),
                          )
                          if (!duplicateElementsForDrag(sourceElements)) {
                            event.target.stopDrag()
                          }
                          return
                        }
                        beginMultiSelectionDrag()
                        return
                      }

                      if (event.evt.altKey) {
                        const sourceElement = currentScene.elements.find((item) => item.id === element.id)
                        if (!sourceElement || !duplicateElementsForDrag([sourceElement])) {
                          event.target.stopDrag()
                        }
                      }
                    }}
                    onDragMove={(event) => {
                      if (event.evt.button !== 0) {
                        event.target.stopDrag()
                        const displayNode = elementNodeMapRef.current[element.id]
                        if (displayNode) {
                          displayNode.position({
                            x: element.x,
                            y: element.y,
                          })
                        }
                        elementsDisplayLayerRef.current?.batchDraw()
                        return
                      }

                      if (multiDragOriginRef.current) {
                        const pointer = getPointerWorldPosition()
                        if (!pointer) {
                          return
                        }
                        const originalPosition = altCloneOriginalPositionsRef.current[element.id]
                        if (originalPosition) {
                          event.target.position(originalPosition)
                          const originalDisplayNode = elementNodeMapRef.current[element.id]
                          if (originalDisplayNode) {
                            originalDisplayNode.position(originalPosition)
                          }
                        }
                        const activeId = multiDragOriginRef.current.ids[0]
                        const origin = altCloneSourceRef.current ?? multiDragOriginRef.current.positions[element.id] ?? multiDragOriginRef.current.positions[activeId]
                        if (!origin) {
                          return
                        }
                        const deltaX = pointer.x - multiDragOriginRef.current.pointerStart.x
                        const deltaY = pointer.y - multiDragOriginRef.current.pointerStart.y
                        previewMultiSelectionDrag(deltaX, deltaY)
                        return
                      }

                      const displayNode = elementNodeMapRef.current[element.id]
                      if (!displayNode) {
                        return
                      }
                      displayNode.position({
                        x: event.target.x(),
                        y: event.target.y(),
                      })
                      elementsDisplayLayerRef.current?.batchDraw()
                    }}
                    onDragEnd={(event) => {
                      if (
                        multiDragOriginRef.current
                      ) {
                        const pointer = getPointerWorldPosition()
                        const originalPosition = altCloneOriginalPositionsRef.current[element.id]
                        if (originalPosition) {
                          event.target.position(originalPosition)
                          const originalDisplayNode = elementNodeMapRef.current[element.id]
                          if (originalDisplayNode) {
                            originalDisplayNode.position(originalPosition)
                          }
                        }
                        const activeId = multiDragOriginRef.current.ids[0]
                        const origin = altCloneSourceRef.current ?? multiDragOriginRef.current.positions[element.id] ?? multiDragOriginRef.current.positions[activeId]
                        if (!origin) {
                          multiDragOriginRef.current = null
                          altCloneSourceRef.current = null
                          altCloneOriginalPositionsRef.current = {}
                          return
                        }
                        if (!pointer) {
                          multiDragOriginRef.current = null
                          altCloneSourceRef.current = null
                          altCloneOriginalPositionsRef.current = {}
                          return
                        }
                        endMultiSelectionDrag(
                          pointer.x - multiDragOriginRef.current.pointerStart.x,
                          pointer.y - multiDragOriginRef.current.pointerStart.y,
                        )
                        return
                      }

                      moveElement(element.id, event.target.x(), event.target.y())
                    }}
                  />
                )
              })}
            </Group>
          </Layer>

          {measureDraft && measureMidpoint && measureDistance !== null && (
            <Layer listening={false}>
              <Group
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                x={viewport.x}
                y={viewport.y}
              >
                <Line
                  points={[
                    measureDraft.startX,
                    measureDraft.startY,
                    measureDraft.endX,
                    measureDraft.endY,
                  ]}
                  stroke="#467AF7"
                  strokeScaleEnabled={false}
                  strokeWidth={2}
                />
                <Group x={measureMidpoint.x} y={measureMidpoint.y}>
                  <Rect
                    cornerRadius={4}
                    fill="rgba(0, 0, 0, 0.86)"
                    height={28 / viewport.scale}
                    offsetX={36 / viewport.scale}
                    offsetY={14 / viewport.scale}
                    width={72 / viewport.scale}
                  />
                  <Text
                    align="center"
                    fill="#ffffff"
                    fontFamily="'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"
                    fontSize={12 / viewport.scale}
                    text={`${measureDistance.toFixed(2)}m`}
                    width={72 / viewport.scale}
                    x={-36 / viewport.scale}
                    y={-6 / viewport.scale}
                  />
                </Group>
              </Group>
            </Layer>
          )}

          <Layer listening={false} ref={selectedLabelLayerRef}>
              <Group ref={selectedLabelGroupRef} visible={false}>
                <Rect
                  ref={selectedLabelRectRef}
                  cornerRadius={SELECTED_LABEL_RADIUS}
                  fill={ELEMENT_HOVER_OUTLINE}
                />
                <Text
                  ref={selectedLabelTextRef}
                  fill="#ffffff"
                  fontFamily={SELECTED_LABEL_FONT_FAMILY}
                  fontSize={SELECTED_LABEL_FONT_SIZE}
                  fontStyle="normal"
                  lineHeight={SELECTED_LABEL_LINE_HEIGHT}
                  verticalAlign="middle"
                />
              </Group>
            </Layer>
        </Stage>
      </div>
    </div>
  )
})
