export type SceneMode = '2d' | '3d'

export type ElementType = 'parking' | 'charger' | 'storage'
export type TileType = 'road' | 'road_zebra' | 'green'

export interface SceneMeta {
  id: string
  name: string
  updatedAt: string
}

export interface SceneCanvas {
  width: number
  height: number
  gridSize: number
  unit: 'm'
}

export interface ParkingParams {
  hasPvCanopy: boolean
  canopyStyle: 'flat' | 'curve'
  parkingType: 'standard' | 'accessible'
}

export interface ChargerParams {
  model: 'charger_120kw' | 'charger_180kw'
}

export interface StorageParams {
  model: 'storage_215kwh' | 'storage_372kwh'
}

export type ElementParams = ParkingParams | ChargerParams | StorageParams

export interface SceneElement {
  id: string
  type: ElementType
  x: number
  y: number
  rotation: number
  params: ElementParams
}

export interface SceneTile {
  id: string
  tileType: TileType
  col: number
  row: number
}

export interface SceneDocument {
  version: '1.0.0'
  meta: SceneMeta
  canvas: SceneCanvas
  elements: SceneElement[]
  tiles: SceneTile[]
}

export interface SceneTemplate {
  id: string
  name: string
  description: string
  scene: SceneDocument
}

export function createDefaultScene(): SceneDocument {
  const now = new Date().toISOString()
  return {
    version: '1.0.0',
    meta: {
      id: crypto.randomUUID(),
      name: '新建站点方案',
      updatedAt: now,
    },
    canvas: {
      width: 1600,
      height: 900,
      gridSize: 80,
      unit: 'm',
    },
    elements: [],
    tiles: [],
  }
}

export function createTemplateScene(): SceneDocument {
  const base = createDefaultScene()
  return {
    ...base,
    meta: {
      ...base.meta,
      name: '光储充标准模板',
    },
    elements: [
      {
        id: crypto.randomUUID(),
        type: 'parking',
        x: 420,
        y: 300,
        rotation: 0,
        params: {
          hasPvCanopy: true,
          canopyStyle: 'flat',
          parkingType: 'standard',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'parking',
        x: 560,
        y: 300,
        rotation: 0,
        params: {
          hasPvCanopy: true,
          canopyStyle: 'flat',
          parkingType: 'standard',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'charger',
        x: 680,
        y: 300,
        rotation: 90,
        params: {
          model: 'charger_120kw',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'storage',
        x: 980,
        y: 260,
        rotation: 0,
        params: {
          model: 'storage_215kwh',
        },
      },
    ],
    tiles: [
      { id: crypto.randomUUID(), tileType: 'road', col: 3, row: 6 },
      { id: crypto.randomUUID(), tileType: 'road', col: 4, row: 6 },
      { id: crypto.randomUUID(), tileType: 'road', col: 5, row: 6 },
      { id: crypto.randomUUID(), tileType: 'road_zebra', col: 6, row: 6 },
      { id: crypto.randomUUID(), tileType: 'green', col: 11, row: 2 },
      { id: crypto.randomUUID(), tileType: 'green', col: 11, row: 3 },
    ],
  }
}
