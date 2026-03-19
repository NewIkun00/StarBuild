import { create } from 'zustand'
import { editorDb } from '../lib/db'
import { getCatalogItem } from '../lib/catalog'
import { normalizeParkingParams, normalizeSceneDocument } from '../lib/parkingSlots'
import { getElementSceneSize } from '../lib/sceneGeometry'
import {
  createDefaultScene,
  createTemplateScene,
  type ElementParams,
  type ElementType,
  type ParkingParams,
  type SceneDocument,
  type SceneElement,
  type SceneMode,
  type SceneTemplate,
  type TileType,
} from '../types/scene'

type AppView = 'home' | 'editor'
const MAX_UNDO_STEPS = 10

export interface SceneSummary {
  id: string
  name: string
  updatedAt: string
  elementCount: number
}

interface HistoryEntry {
  scene: SceneDocument
  selectedIds: string[]
}

export type GroundEditAction = 'create' | 'delete'
export type GroundEditMode = 'point' | 'marquee' | 'brush'

const sceneTemplates: SceneTemplate[] = [
  {
    id: 'template-standard',
    name: '光储充标准模板',
    description: '预置车位、充电桩、储能柜和基础道路关系，适合快速出图。',
    scene: createTemplateScene(),
  },
]

function cloneScene(scene: SceneDocument): SceneDocument {
  return JSON.parse(JSON.stringify(scene)) as SceneDocument
}

function cloneHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    scene: cloneScene(entry.scene),
    selectedIds: [...entry.selectedIds],
  }
}

function pushHistoryEntry(history: HistoryEntry[], entry: HistoryEntry) {
  return [...history, cloneHistoryEntry(entry)].slice(-MAX_UNDO_STEPS)
}

function cloneElementSnapshot(element: SceneElement): SceneElement {
  const cloned = JSON.parse(JSON.stringify(element)) as SceneElement
  cloned.id = crypto.randomUUID()

  if (cloned.type === 'parking') {
    const params = cloned.params as ParkingParams
    params.slots = params.slots.map((slot) => ({
      ...slot,
      id: crypto.randomUUID(),
      children: slot.children.map((child) => ({
        ...child,
        id: crypto.randomUUID(),
      })),
    }))
  }

  return cloned
}

function getElementsCenter(elements: SceneElement[]) {
  if (elements.length === 0) {
    return { x: 0, y: 0 }
  }

  const bounds = elements
    .map((element) => {
      const size = getElementSceneSize(element)
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
    })
    .reduce(
      (accumulator, next) => ({
        minX: Math.min(accumulator.minX, next.minX),
        minY: Math.min(accumulator.minY, next.minY),
        maxX: Math.max(accumulator.maxX, next.maxX),
        maxY: Math.max(accumulator.maxY, next.maxY),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    )

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

function stampScene(scene: SceneDocument): SceneDocument {
  return {
    ...scene,
    meta: {
      ...scene.meta,
      updatedAt: new Date().toISOString(),
    },
  }
}

function summarizeScene(scene: SceneDocument): SceneSummary {
  return {
    id: scene.meta.id,
    name: scene.meta.name,
    updatedAt: scene.meta.updatedAt,
    elementCount: scene.elements.length,
  }
}

async function loadSceneSummaries(): Promise<SceneSummary[]> {
  const records = await editorDb.scenes.orderBy('updatedAt').reverse().toArray()
  return records.map((record) => summarizeScene(record.scene))
}

interface EditorState {
  appView: AppView
  mode: SceneMode
  scene: SceneDocument | null
  scenes: SceneSummary[]
  historyPast: HistoryEntry[]
  selectedId: string | null
  selectedIds: string[]
  activeTileBrush: TileType | null
  groundEditAction: GroundEditAction
  groundEditMode: GroundEditMode
  showGrid: boolean
  measureMode: boolean
  templates: SceneTemplate[]
  initialize: () => Promise<string>
  openScene: (id: string) => Promise<void>
  createEmptyScene: (name?: string) => Promise<void>
  createSceneFromTemplate: (templateId: string, name?: string) => Promise<void>
  importSceneToLibrary: (scene: SceneDocument) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  renameScene: (id: string, name: string) => Promise<void>
  returnHome: () => Promise<void>
  setMode: (mode: SceneMode) => void
  setSceneName: (name: string) => void
  addElement: (type: ElementType) => void
  addElementAt: (type: ElementType, x: number, y: number) => void
  insertElementsAt: (elements: SceneElement[], targetCenterX: number, targetCenterY: number) => string[]
  moveElement: (id: string, x: number, y: number) => void
  moveElementsBy: (ids: string[], deltaX: number, deltaY: number) => void
  deleteSelectedElement: () => void
  updateElementParams: (id: string, params: Partial<ElementParams>) => void
  updateElementRotation: (id: string, rotation: number) => void
  selectElement: (id: string | null) => void
  selectElements: (ids: string[]) => void
  setShowGrid: (showGrid: boolean) => void
  setMeasureMode: (measureMode: boolean) => void
  toggleTileBrush: (tileType: TileType) => void
  setGroundEditAction: (action: GroundEditAction) => void
  setGroundEditMode: (mode: GroundEditMode) => void
  paintTile: (col: number, row: number) => void
  clearTile: (col: number, row: number) => void
  applyTiles: (cells: Array<{ col: number; row: number }>, action?: GroundEditAction) => void
  undo: () => void
  saveDraft: () => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  appView: 'home',
  mode: '2d',
  scene: null,
  scenes: [],
  historyPast: [],
  selectedId: null,
  selectedIds: [],
  activeTileBrush: null,
  groundEditAction: 'create',
  groundEditMode: 'point',
  showGrid: true,
  measureMode: false,
  templates: sceneTemplates,
  initialize: async () => {
    const scenes = await loadSceneSummaries()
    set({ scenes, appView: 'home' })
    return scenes.length > 0 ? '已加载本机场景列表' : '还没有本地场景，先新建一个吧'
  },
  openScene: async (id) => {
    const record = await editorDb.scenes.get(id)
    if (!record) {
      set({ scenes: await loadSceneSummaries() })
      return
    }
    const scene = normalizeSceneDocument(record.scene)
    set({
      appView: 'editor',
      mode: '2d',
      scene,
      historyPast: [],
      selectedId: scene.elements[0]?.id ?? null,
      selectedIds: scene.elements[0]?.id ? [scene.elements[0].id] : [],
      activeTileBrush: null,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })
  },
  createEmptyScene: async (name) => {
    const baseScene = createDefaultScene()
    const scene = stampScene({
      ...baseScene,
      meta: {
        ...baseScene.meta,
        name: name?.trim() || '新建站点方案',
      },
    })
    await editorDb.scenes.put({
      id: scene.meta.id,
      scene,
      updatedAt: scene.meta.updatedAt,
    })
    set({
      appView: 'editor',
      mode: '2d',
      scene,
      scenes: await loadSceneSummaries(),
      historyPast: [],
      selectedId: null,
      selectedIds: [],
      activeTileBrush: null,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })
  },
  createSceneFromTemplate: async (templateId, name) => {
    const template = get().templates.find((item) => item.id === templateId)
    if (!template) {
      return
    }
    const templateScene = cloneScene(template.scene)
    const scene = stampScene({
      ...templateScene,
      meta: {
        ...templateScene.meta,
        id: crypto.randomUUID(),
        name:
          name?.trim() || `${template.name}-${new Date().toLocaleDateString('zh-CN')}`,
      },
    })
    await editorDb.scenes.put({
      id: scene.meta.id,
      scene,
      updatedAt: scene.meta.updatedAt,
    })
    set({
      appView: 'editor',
      mode: '2d',
      scene,
      scenes: await loadSceneSummaries(),
      historyPast: [],
      selectedId: scene.elements[0]?.id ?? null,
      selectedIds: scene.elements[0]?.id ? [scene.elements[0].id] : [],
      activeTileBrush: null,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })
  },
  importSceneToLibrary: async (scene) => {
    const normalizedScene = normalizeSceneDocument(cloneScene(scene))
    const stamped = stampScene({
      ...normalizedScene,
      meta: {
        ...scene.meta,
        id: scene.meta.id || crypto.randomUUID(),
        name: scene.meta.name || '导入场景',
      },
    })
    await editorDb.scenes.put({
      id: stamped.meta.id,
      scene: stamped,
      updatedAt: stamped.meta.updatedAt,
    })
    set({
      appView: 'editor',
      mode: '2d',
      scene: stamped,
      scenes: await loadSceneSummaries(),
      historyPast: [],
      selectedId: stamped.elements[0]?.id ?? null,
      selectedIds: stamped.elements[0]?.id ? [stamped.elements[0].id] : [],
      activeTileBrush: null,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })
  },
  deleteScene: async (id) => {
    await editorDb.scenes.delete(id)
    const nextScenes = await loadSceneSummaries()
    const current = get().scene
    set({
      scenes: nextScenes,
      appView: current?.meta.id === id ? 'home' : get().appView,
      scene: current?.meta.id === id ? null : current,
      selectedId: current?.meta.id === id ? null : get().selectedId,
      selectedIds: current?.meta.id === id ? [] : get().selectedIds,
    })
  },
  renameScene: async (id, name) => {
    const record = await editorDb.scenes.get(id)
    if (!record) {
      return
    }
    const scene = stampScene({
      ...record.scene,
      meta: {
        ...record.scene.meta,
        name,
      },
    })
    await editorDb.scenes.put({
      id,
      scene,
      updatedAt: scene.meta.updatedAt,
    })

    const current = get().scene
    set({
      scenes: await loadSceneSummaries(),
      scene: current?.meta.id === id ? scene : current,
    })
  },
  returnHome: async () => {
    await get().saveDraft()
    set({
      appView: 'home',
      mode: '2d',
      scenes: await loadSceneSummaries(),
      historyPast: [],
      selectedId: null,
      selectedIds: [],
      activeTileBrush: null,
      measureMode: false,
    })
  },
  setMode: (mode) => set({ mode }),
  setSceneName: (name) =>
    set((state) => ({
      historyPast:
        state.scene && state.scene.meta.name !== name
          ? pushHistoryEntry(state.historyPast, {
              scene: state.scene,
              selectedIds: state.selectedIds,
            })
          : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            meta: {
              ...state.scene.meta,
              name,
            },
          })
        : null,
    })),
  addElementAt: (type, x, y) =>
    set((state) => {
      if (!state.scene) {
        return state
      }
      const catalogItem = getCatalogItem(type)
      const element: SceneElement = {
        id: crypto.randomUUID(),
        type,
        x,
        y,
        rotation: 0,
        params: catalogItem.createDefaultParams(),
      }
      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        selectedId: element.id,
        selectedIds: [element.id],
        activeTileBrush: null,
        scene: stampScene({
          ...state.scene,
          elements: [...state.scene.elements, element],
        }),
      }
    }),
  addElement: (type) =>
    set((state) => {
      if (!state.scene) {
        return state
      }
      const catalogItem = getCatalogItem(type)
      const element: SceneElement = {
        id: crypto.randomUUID(),
        type,
        x: state.scene.canvas.width / 2,
        y: state.scene.canvas.height / 2,
        rotation: 0,
        params: catalogItem.createDefaultParams(),
      }
      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        selectedId: element.id,
        selectedIds: [element.id],
        activeTileBrush: null,
        scene: stampScene({
          ...state.scene,
          elements: [...state.scene.elements, element],
        }),
      }
    }),
  insertElementsAt: (elements, targetCenterX, targetCenterY) => {
    let createdIds: string[] = []

    set((state) => {
      if (!state.scene || elements.length === 0) {
        return state
      }

      const sourceCenter = getElementsCenter(elements)
      const deltaX = targetCenterX - sourceCenter.x
      const deltaY = targetCenterY - sourceCenter.y
      const clones = elements.map((element) => {
        const clone = cloneElementSnapshot(element)
        return {
          ...clone,
          x: clone.x + deltaX,
          y: clone.y + deltaY,
        }
      })
      createdIds = clones.map((element) => element.id)

      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        selectedId: createdIds[0] ?? null,
        selectedIds: createdIds,
        activeTileBrush: null,
        scene: stampScene({
          ...state.scene,
          elements: [...state.scene.elements, ...clones],
        }),
      }
    })

    return createdIds
  },
  moveElement: (id, x, y) =>
    set((state) => ({
      historyPast: state.scene
        ? pushHistoryEntry(state.historyPast, {
            scene: state.scene,
            selectedIds: state.selectedIds,
          })
        : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, x, y } : element,
            ),
          })
        : null,
    })),
  moveElementsBy: (ids, deltaX, deltaY) =>
    set((state) => ({
      historyPast: state.scene
        ? pushHistoryEntry(state.historyPast, {
            scene: state.scene,
            selectedIds: state.selectedIds,
          })
        : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              ids.includes(element.id)
                ? {
                    ...element,
                    x: element.x + deltaX,
                    y: element.y + deltaY,
                  }
                : element,
            ),
          })
        : null,
    })),
  deleteSelectedElement: () =>
    set((state) => {
      if (!state.scene || state.selectedIds.length === 0) {
        return state
      }
      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        selectedId: null,
        selectedIds: [],
        scene: stampScene({
          ...state.scene,
          elements: state.scene.elements.filter(
            (element) => !state.selectedIds.includes(element.id),
          ),
        }),
      }
    }),
  updateElementParams: (id, params) =>
    set((state) => ({
      historyPast: state.scene
        ? pushHistoryEntry(state.historyPast, {
            scene: state.scene,
            selectedIds: state.selectedIds,
          })
        : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id
                ? {
                    ...element,
                    params:
                      element.type === 'parking'
                        ? normalizeParkingParams({
                            ...(element.params as ParkingParams),
                            ...params,
                          })
                        : {
                            ...element.params,
                            ...params,
                          },
                  }
                : element,
            ),
          })
        : null,
    })),
  updateElementRotation: (id, rotation) =>
    set((state) => ({
      historyPast: state.scene
        ? pushHistoryEntry(state.historyPast, {
            scene: state.scene,
            selectedIds: state.selectedIds,
          })
        : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, rotation } : element,
            ),
          })
        : null,
    })),
  selectElement: (id) =>
    set((state) => {
      if (state.selectedId === id && state.activeTileBrush === null) {
        return state
      }
      return {
        selectedId: id,
        selectedIds: id ? [id] : [],
        activeTileBrush: null,
        groundEditAction: 'create',
        groundEditMode: 'point',
        measureMode: false,
      }
    }),
  selectElements: (ids) =>
    set(() => ({
      selectedId: ids[0] ?? null,
      selectedIds: ids,
      activeTileBrush: null,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })),
  setShowGrid: (showGrid) => set({ showGrid }),
  setMeasureMode: (measureMode) =>
    set((state) => ({
      measureMode,
      activeTileBrush: measureMode ? null : state.activeTileBrush,
    })),
  toggleTileBrush: (tileType) =>
    set((state) => ({
      selectedId: null,
      selectedIds: [],
      activeTileBrush: state.activeTileBrush === tileType ? null : tileType,
      groundEditAction: 'create',
      groundEditMode: 'point',
      measureMode: false,
    })),
  setGroundEditAction: (groundEditAction) => set({ groundEditAction }),
  setGroundEditMode: (groundEditMode) => set({ groundEditMode }),
  paintTile: (col, row) =>
    set((state) => {
      if (!state.scene || !state.activeTileBrush) {
        return state
      }
      const existing = state.scene.tiles.find(
        (tile) => tile.col === col && tile.row === row,
      )
      const nextTiles = existing
        ? state.scene.tiles.map((tile) =>
            tile.col === col && tile.row === row
              ? { ...tile, tileType: state.activeTileBrush as TileType }
              : tile,
          )
        : [
            ...state.scene.tiles,
            {
              id: crypto.randomUUID(),
              tileType: state.activeTileBrush,
              col,
              row,
            },
          ]

      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        scene: stampScene({
          ...state.scene,
          tiles: nextTiles,
        }),
      }
    }),
  clearTile: (col, row) =>
    set((state) => ({
      historyPast: state.scene
        ? pushHistoryEntry(state.historyPast, {
            scene: state.scene,
            selectedIds: state.selectedIds,
          })
        : state.historyPast,
      scene: state.scene
        ? stampScene({
            ...state.scene,
            tiles: state.scene.tiles.filter(
              (tile) => tile.col !== col || tile.row !== row,
            ),
          })
        : null,
    })),
  applyTiles: (cells, action) =>
    set((state) => {
      if (!state.scene || cells.length === 0) {
        return state
      }

      const nextAction = action ?? state.groundEditAction
      const uniqueCells = Array.from(
        new Map(cells.map((cell) => [`${cell.col}:${cell.row}`, cell])).values(),
      )

      let nextTiles = [...state.scene.tiles]

      if (nextAction === 'delete') {
        const removalKeys = new Set(uniqueCells.map((cell) => `${cell.col}:${cell.row}`))
        nextTiles = nextTiles.filter((tile) => !removalKeys.has(`${tile.col}:${tile.row}`))
      } else {
        const activeBrush = state.activeTileBrush
        if (!activeBrush) {
          return state
        }
        const tileMap = new Map<string, (typeof nextTiles)[number]>(
          nextTiles.map((tile) => [`${tile.col}:${tile.row}`, tile] as const),
        )
        uniqueCells.forEach(({ col, row }) => {
          const key = `${col}:${row}`
          const existing = tileMap.get(key)
          tileMap.set(
            key,
            existing
              ? { ...existing, tileType: activeBrush }
              : {
                  id: crypto.randomUUID(),
                  tileType: activeBrush,
                  col,
                  row,
                },
          )
        })
        nextTiles = Array.from(tileMap.values())
      }

      return {
        historyPast: pushHistoryEntry(state.historyPast, {
          scene: state.scene,
          selectedIds: state.selectedIds,
        }),
        scene: stampScene({
          ...state.scene,
          tiles: nextTiles,
        }),
      }
    }),
  undo: () =>
    set((state) => {
      const previous = state.historyPast[state.historyPast.length - 1]
      if (!previous) {
        return state
      }

      const restoredScene = stampScene(cloneScene(previous.scene))
      const validSelectedIds = previous.selectedIds.filter((id) =>
        restoredScene.elements.some((element) => element.id === id),
      )

      return {
        scene: restoredScene,
        historyPast: state.historyPast.slice(0, -1),
        selectedId: validSelectedIds[0] ?? null,
        selectedIds: validSelectedIds,
        activeTileBrush: null,
        groundEditAction: 'create',
        groundEditMode: 'point',
        measureMode: false,
      }
    }),
  saveDraft: async () => {
    const scene = get().scene
    if (!scene) {
      return
    }
    const copy = cloneScene(scene)
    await editorDb.scenes.put({
      id: copy.meta.id,
      scene: copy,
      updatedAt: copy.meta.updatedAt,
    })
    set({ scenes: await loadSceneSummaries() })
  },
}))
