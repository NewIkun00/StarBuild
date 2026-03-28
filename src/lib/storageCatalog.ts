import { metersToSceneUnits } from './units'
import type { StorageParams } from '../types/scene'

export const storageModelOptions = [
  { label: '261储能柜', value: 'storage_261' },
  { label: '418储能柜', value: 'storage_418' },
] as const

export function normalizeStorageModel(model: string | undefined): StorageParams['model'] {
  if (model === 'storage_418' || model === 'storage_372kwh') {
    return 'storage_418'
  }
  return 'storage_261'
}

export function getStorageSceneSize(params: StorageParams) {
  const model = normalizeStorageModel(params.model)

  if (model === 'storage_418') {
    return {
      width: metersToSceneUnits(1.36),   // 宽1.36m
      height: metersToSceneUnits(1.2),   // 深1.2m
    }
  }

  return {
    width: metersToSceneUnits(1),        // 宽1m
    height: metersToSceneUnits(1),       // 深1m
  }
}
