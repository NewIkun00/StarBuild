import type {
  ChargerParams,
  ElementParams,
  ElementType,
  ParkingParams,
  StorageParams,
  TileType,
} from '../types/scene'
import { createParkingSlots } from './parkingSlots'
import { metersToSceneUnits } from './units'

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
  category: 'asphalt' | 'concrete' | 'green' | 'water' | 'path'
}

export const sceneCatalog: CatalogItem[] = [
  {
    type: 'parking',
    title: '车位',
    description: '支持车棚、车位类型和样式切换。',
    color: '#434343',
    size: { width: metersToSceneUnits(2.5), height: metersToSceneUnits(5.5) },
    createDefaultParams: (): ParkingParams => ({
      widthM: 2.5,
      lengthM: 5.5,
      count: 1,
      slots: createParkingSlots(1),
      canopyType: 'none',
      carportStyle: 'y',
      steelColor: '#FFFFFF',
      parkingType: 'ordinary',
    }),
  },
  {
    type: 'charger',
    title: '充电桩',
    description: '可切换不同功率和设备型号。',
    color: '#fb7185',
    size: { width: 52, height: 52 },
    createDefaultParams: (): ChargerParams => ({
      chargerType: 'integrated',
      model: '双子座V3.2 120kW',
    }),
  },
  {
    type: 'storage',
    title: '储能柜',
    description: '适配不同容量柜体配置。',
    color: '#34d399',
    size: { width: 92, height: 92 },
    createDefaultParams: (): StorageParams => ({
      model: 'storage_261',
    }),
  },
]

export const tileCatalog: TileCatalogItem[] = [
  { type: 'road', title: '沥青', color: '#6b7280', category: 'asphalt' },
  { type: 'concrete', title: '水泥', color: '#bfc5cd', category: 'concrete' },
  { type: 'green', title: '绿化', color: '#86efac', category: 'green' },
  { type: 'water', title: '水面', color: '#5fa8ff', category: 'water' },
  { type: 'path', title: '步道', color: '#b89d7a', category: 'path' },
  { type: 'road_zebra', title: '斑马线道路', color: '#475569', category: 'asphalt' },
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
