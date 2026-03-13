import { create } from 'zustand'
import { editorDb } from '../lib/db'
import { getCatalogItem } from '../lib/catalog'
import {
  createDefaultScene,
  createTemplateScene,
  type ElementParams,
  type ElementType,
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
  activeTileBrush: TileType | null
  templates: SceneTemplate[]
  initialize: () => Promise<string>
  openScene: (id: string) => Promise<void>
  createEmptyScene: () => Promise<void>
  createSceneFromTemplate: (templateId: string) => Promise<void>
  importSceneToLibrary: (scene: SceneDocument) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  renameScene: (id: string, name: string) => Promise<void>
  returnHome: () => Promise<void>
  setMode: (mode: SceneMode) => void
  setSceneName: (name: string) => void
  addElement: (type: ElementType) => void
  moveElement: (id: string, x: number, y: number) => void
  updateElementParams: (id: string, params: Partial<ElementParams>) => void
  updateElementRotation: (id: string, rotation: number) => void
  selectElement: (id: string | null) => void
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
  activeTileBrush: null,
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
    set({
      appView: 'editor',
      mode: '2d',
      scene: record.scene,
      selectedId: record.scene.elements[0]?.id ?? null,
      activeTileBrush: null,
    })
  },
  createEmptyScene: async () => {
    const scene = stampScene(createDefaultScene())
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
      activeTileBrush: null,
    })
  },
  createSceneFromTemplate: async (templateId) => {
    const template = get().templates.find((item) => item.id === templateId)
    if (!template) {
      return
    }
    const scene = stampScene({
      ...cloneScene(template.scene),
      meta: {
        ...cloneScene(template.scene).meta,
        id: crypto.randomUUID(),
        name: `${template.name}-${new Date().toLocaleDateString('zh-CN')}`,
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
      activeTileBrush: null,
    })
  },
  importSceneToLibrary: async (scene) => {
    const stamped = stampScene({
      ...cloneScene(scene),
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
      activeTileBrush: null,
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
      activeTileBrush: null,
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
  updateElementParams: (id, params) =>
    set((state) => ({
      scene: state.scene
        ? stampScene({
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id
                ? {
                    ...element,
                    params: {
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
  selectElement: (id) => set({ selectedId: id, activeTileBrush: null }),
  toggleTileBrush: (tileType) =>
    set((state) => ({
      selectedId: null,
      activeTileBrush: state.activeTileBrush === tileType ? null : tileType,
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
