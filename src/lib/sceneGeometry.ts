import { getCatalogItem } from './catalog'
import { getChargerSceneSize } from './chargerCatalog'
import { normalizeParkingParams } from './parkingSlots'
import { getUnitsPerMeter, metersToSceneUnits } from './units'
import type { ChargerParams, ParkingParams, SceneElement } from '../types/scene'

export function getElementSceneSize(element: SceneElement) {
  const item = getCatalogItem(element.type)

  if (element.type === 'charger') {
    return getChargerSceneSize(element.params as ChargerParams)
  }

  if (element.type !== 'parking') {
    return item.size
  }

  const parkingParams = normalizeParkingParams(element.params as ParkingParams)
  const count = parkingParams.slots.length
  const widthM = parkingParams.widthM || 2.5
  const lengthM = parkingParams.lengthM || 5.5

  return {
    width: metersToSceneUnits(widthM * count),
    height: metersToSceneUnits(lengthM),
  }
}

export function getElementMeterSize(
  element: SceneElement,
  unitsPerMeter?: number,
) {
  const sceneSize = getElementSceneSize(element)
  const safeUnitsPerMeter = getUnitsPerMeter(unitsPerMeter)
  return {
    width: sceneSize.width / safeUnitsPerMeter,
    height: sceneSize.height / safeUnitsPerMeter,
  }
}
