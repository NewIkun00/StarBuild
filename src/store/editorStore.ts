import { create } from 'zustand'
import { editorDb } from '../lib/db'
import { getCatalogItem } from '../lib/catalog'
import { normalizeParkingParams, normalizeSceneDocument } from '../lib/parkingSlots'
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

export interface SceneSummary {
  id: string
  name: string
  updatedAt: string
  elementCount: number
}

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
  selectedId: string | null
  selectedIds: string[]
  activeTileBrush: TileType | null
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
  moveElement: (id: string, x: number, y: number) => void
  deleteSelectedElement: () => void
  updateElementParams: (id: string, params: Partial<ElementParams>) => void
  updateElementRotation: (id: string, rotation: number) => void
  selectElement: (id: string | null) => void
  selectElements: (ids: string[]) => void
  setShowGrid: (showGrid: boolean) => void
  setMeasureMode: (measureMode: boolean) => void
  toggleTileBrush: (tileType: TileType) => void
  paintTile: (col: number, row: number) => void
  clearTile: (col: number, row: number) => void
  saveDraft: () => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  appView: 'home',
  mode: '2d',
  scene: null,
  scenes: [],
  selectedId: null,
  selectedIds: [],
  activeTileBrush: null,
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
      selectedId: scene.elements[0]?.id ?? null,
      selectedIds: scene.elements[0]?.id ? [scene.elements[0].id] : [],
      activeTileBrush: null,
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
      selectedId: null,
      selectedIds: [],
      activeTileBrush: null,
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
      selectedId: scene.elements[0]?.id ?? null,
      selectedIds: scene.elements[0]?.id ? [scene.elements[0].id] : [],
      activeTileBrush: null,
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
      selectedId: stamped.elements[0]?.id ?? null,
      selectedIds: stamped.elements[0]?.id ? [stamped.elements[0].id] : [],
      activeTileBrush: null,
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
      selectedId: null,
      selectedIds: [],
      activeTileBrush: null,
      measureMode: false,
    })
  },
  setMode: (mode) => set({ mode }),
  setSceneName: (name) =>
    set((state) => ({
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
        selectedId: element.id,
        selectedIds: [element.id],
        activeTileBrush: null,
        scene: stampScene({
          ...state.scene,
          elements: [...state.scene.elements, element],
        }),
      }
    }),
  moveElement: (id, x, y) =>
    set((state) => ({
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, x, y } : element,
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
        measureMode: false,
      }
    }),
  selectElements: (ids) =>
    set(() => ({
      selectedId: ids[0] ?? null,
      selectedIds: ids,
      activeTileBrush: null,
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
      measureMode: false,
    })),
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
        scene: stampScene({
          ...state.scene,
          tiles: nextTiles,
        }),
      }
    }),
  clearTile: (col, row) =>
    set((state) => ({
      scene: state.scene
        ? stampScene({
            ...state.scene,
            tiles: state.scene.tiles.filter(
              (tile) => tile.col !== col || tile.row !== row,
            ),
          })
        : null,
    })),
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
