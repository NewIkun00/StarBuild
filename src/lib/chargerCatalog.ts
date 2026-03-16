import { metersToSceneUnits } from './units'
import type { ChargerParams } from '../types/scene'

type ChargerType = NonNullable<ChargerParams['chargerType']>

type ChargerMeterSize = {
  widthM: number
  heightM: number
}

type ChargerModelOptionMap = Record<ChargerType, string[]>

export const chargerModelOptions: ChargerModelOptionMap = {
  ac: [
    '\u661f\u8dc3',
    '\u5f2f\u6708',
    '\u661f\u8fc8',
    '\u661f\u9645',
    '\u6781\u5149',
    '\u542f\u660e\u661f',
  ],
  integrated: [
    '\u5929\u674320kW',
    '\u53cc\u5b50\u5ea72\u4ee330/40kW',
    '\u53cc\u5b50\u5ea7V3.2 60/80kW',
    '\u53cc\u5b50\u5ea7V3.2 120kW',
    '\u53cc\u5b50\u5ea7V3.2 160kW',
    '\u53cc\u5b50\u5ea7V3.2 180/240kW',
    '\u91d1\u725b\u5ea74.2 240/320/360/400kW',
  ],
  split: [
    '\u661f\u9a70300/400A',
    '\u661f\u6d77600A',
    '\u661f\u6d771200A',
  ],
  v2g: [
    'Halo\u53cc\u5411\u5145\u7535\u68697/11kW',
    '\u53cc\u5b50\u5ea73\u4ee330kW',
    '\u53cc\u5b50\u5ea73\u4ee3Pro 120kW',
  ],
}

export const chargerTypeOptions = [
  { label: '\u4ea4\u6d41\u6869', value: 'ac' },
  { label: '\u4e00\u4f53\u6869', value: 'integrated' },
  { label: '\u5206\u4f53\u6869', value: 'split' },
  { label: 'V2G', value: 'v2g' },
] as const

const chargerMeterSizeMap: Record<string, ChargerMeterSize> = {
  '\u661f\u8dc3': { widthM: 0.3, heightM: 0.2 },
  '\u5f2f\u6708': { widthM: 0.3, heightM: 0.2 },
  '\u661f\u8fc8': { widthM: 0.3, heightM: 0.2 },
  '\u661f\u9645': { widthM: 0.3, heightM: 0.2 },
  '\u6781\u5149': { widthM: 0.3, heightM: 0.2 },
  '\u542f\u660e\u661f': { widthM: 0.3, heightM: 0.2 },
  '\u5929\u674320kW': { widthM: 0.44, heightM: 0.2 },
  '\u53cc\u5b50\u5ea72\u4ee330/40kW': { widthM: 0.7, heightM: 0.25 },
  '\u53cc\u5b50\u5ea7V3.2 60/80kW': { widthM: 0.8, heightM: 0.35 },
  '\u53cc\u5b50\u5ea7V3.2 120kW': { widthM: 0.85, heightM: 0.55 },
  '\u53cc\u5b50\u5ea7V3.2 160kW': { widthM: 0.85, heightM: 0.55 },
  '\u53cc\u5b50\u5ea7V3.2 180/240kW': { widthM: 0.85, heightM: 0.75 },
  '\u91d1\u725b\u5ea74.2 240/320/360/400kW': { widthM: 1, heightM: 0.85 },
  '\u661f\u9a70300/400A': { widthM: 0.35, heightM: 0.2 },
  '\u661f\u6d77600A': { widthM: 0.5, heightM: 0.25 },
  '\u661f\u6d771200A': { widthM: 0.5, heightM: 0.45 },
  'Halo\u53cc\u5411\u5145\u7535\u68697/11kW': { widthM: 0.3, heightM: 0.2 },
  '\u53cc\u5b50\u5ea73\u4ee330kW': { widthM: 0.7, heightM: 0.26 },
  '\u53cc\u5b50\u5ea73\u4ee3Pro 120kW': { widthM: 0.85, heightM: 0.55 },
}

export function normalizeChargerType(
  chargerType: ChargerParams['chargerType'],
  model: string,
): ChargerType {
  if (chargerType && chargerType in chargerModelOptions) {
    return chargerType
  }

  const detected = (Object.entries(chargerModelOptions) as Array<[ChargerType, string[]]>).find(
    ([, models]) => models.includes(model),
  )

  return detected?.[0] ?? 'integrated'
}

export function getChargerMeterSize(params: ChargerParams): ChargerMeterSize {
  const normalizedType = normalizeChargerType(params.chargerType, params.model)
  const fallbackModel = chargerModelOptions[normalizedType][0]
  const resolvedModel = chargerMeterSizeMap[params.model] ? params.model : fallbackModel

  return chargerMeterSizeMap[resolvedModel] ?? { widthM: 0.85, heightM: 0.55 }
}

export function getChargerSceneSize(params: ChargerParams) {
  const meterSize = getChargerMeterSize(params)

  return {
    width: metersToSceneUnits(meterSize.widthM),
    height: metersToSceneUnits(meterSize.heightM),
  }
}
