// Hidden measurement grid for the 2D editor: 1 scene unit = 0.1 meter.
export const SCENE_UNITS_PER_METER = 10

export function metersToSceneUnits(meters: number) {
  return meters * SCENE_UNITS_PER_METER
}

export function getUnitsPerMeter(unitsPerMeter?: number) {
  return unitsPerMeter ?? SCENE_UNITS_PER_METER
}
