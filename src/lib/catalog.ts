import type {
  ChargerParams,
  ElementParams,
  ElementType,
  ParkingParams,
  StorageParams,
  TileType,
} from '../types/scene'

export interface CatalogItem {
  type: ElementType
  title: string
  description: string
  color: string
  size: {
    width: number
    height: number
  }
  createDefaultParams: () => ElementParams
}

export interface TileCatalogItem {
  type: TileType
  title: string
  color: string
}

export const sceneCatalog: CatalogItem[] = [
  {
    type: 'parking',
    title: '车位',
    description: '支持车棚、车位类型和样式切换。',
    color: '#38bdf8',
    size: { width: 120, height: 60 },
    createDefaultParams: (): ParkingParams => ({
      hasPvCanopy: true,
      canopyStyle: 'flat',
      parkingType: 'standard',
    }),
  },
  {
    type: 'charger',
    title: '充电桩',
    description: '可切换不同功率和设备型号。',
    color: '#fb7185',
    size: { width: 52, height: 52 },
    createDefaultParams: (): ChargerParams => ({
      model: 'charger_120kw',
    }),
  },
  {
    type: 'storage',
    title: '储能柜',
    description: '适配不同容量柜体配置。',
    color: '#34d399',
    size: { width: 92, height: 92 },
    createDefaultParams: (): StorageParams => ({
      model: 'storage_215kwh',
    }),
  },
]

export const tileCatalog: TileCatalogItem[] = [
  { type: 'road', title: '马路', color: '#94a3b8' },
  { type: 'road_zebra', title: '斑马线', color: '#475569' },
  { type: 'green', title: '绿化', color: '#86efac' },
]

export function getCatalogItem(type: ElementType): CatalogItem {
  const item = sceneCatalog.find((entry) => entry.type === type)
  if (!item) {
    throw new Error(`Unknown catalog type: ${type}`)
  }
  return item
}

export function getTileCatalogItem(type: TileType): TileCatalogItem {
  const item = tileCatalog.find((entry) => entry.type === type)
  if (!item) {
    throw new Error(`Unknown tile type: ${type}`)
  }
  return item
}
