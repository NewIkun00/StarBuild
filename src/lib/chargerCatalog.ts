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

type DisabledModelMap = Record<ChargerType, string[]>

export const disabledChargerModels: DisabledModelMap = {
  ac: ['\u661f\u8dc3', '\u661f\u8fc8', '\u661f\u9645', '\u542f\u660e\u661f'],
  integrated: [
    '\u5929\u674320kW',
    '\u53cc\u5b50\u5ea7V3.2 60/80kW',
    '\u53cc\u5b50\u5ea7V3.2 120kW',
    '\u53cc\u5b50\u5ea7V3.2 160kW',
    '\u53cc\u5b50\u5ea7V3.2 180/240kW',
    '\u91d1\u725b\u5ea74.2 240/320/360/400kW',
  ],
  split: [],
  v2g: ['Halo\u53cc\u5411\u5145\u7535\u68697/11kW'],
}

type DefaultModelMap = Record<ChargerType, string>

export const defaultChargerModels: DefaultModelMap = {
  ac: '\u5f2f\u6708',
  integrated: '\u53cc\u5b50\u5ea72\u4ee330/40kW',
  split: '\u661f\u9a70300/400A',
  v2g: '\u53cc\u5b50\u5ea73\u4ee330kW',
}

export const chargerTypeOptions: Array<{ label: string; value: string }> = [
  { label: '交流桩', value: 'ac' },
  { label: '一体桩', value: 'integrated' },
  { label: '分体桩', value: 'split' },
  { label: 'V2G', value: 'v2g' },
]

const chargerMeterSizeMap: Record<string, ChargerMeterSize> = {
  '\u661f\u8dc3': { widthM: 0.4, heightM: 0.3 },                          // 星驰: 宽40cm, 深30cm
  '\u5f2f\u6708': { widthM: 0.5, heightM: 0.5 },                          // 弯月: 宽50cm, 深50cm
  '\u661f\u8fc8': { widthM: 0.3, heightM: 0.2 },                          // 星迈: 宽30cm, 深20cm
  '\u661f\u9645': { widthM: 0.3, heightM: 0.2 },                          // 星迹: 宽30cm, 深20cm
  '\u6781\u5149': { widthM: 0.42, heightM: 0.36 },                        // 极光: 宽42cm, 深36cm
  '\u542f\u660e\u661f': { widthM: 0.3, heightM: 0.2 },                     // 启明星: 宽30cm, 深20cm
  '\u5929\u674320kW': { widthM: 0.44, heightM: 0.2 },                      // 天枢20kW: 宽44cm, 深20cm
  '\u53cc\u5b50\u5ea72\u4ee330/40kW': { widthM: 0.94, heightM: 0.48 },    // 双子座2代30/40kW: 宽94cm, 深48cm
  '\u53cc\u5b50\u5ea7V3.2 60/80kW': { widthM: 0.8, heightM: 0.35 },        // 双子座V3.2 60/80kW: 宽80cm, 深35cm
  '\u53cc\u5b50\u5ea7V3.2 120kW': { widthM: 0.85, heightM: 0.55 },         // 双子座V3.2 120kW: 宽85cm, 深55cm
  '\u53cc\u5b50\u5ea7V3.2 160kW': { widthM: 0.85, heightM: 0.55 },        // 双子座V3.2 160kW: 宽85cm, 深55cm
  '\u53cc\u5b50\u5ea7V3.2 180/240kW': { widthM: 0.85, heightM: 0.75 },    // 双子座V3.2 180/240kW: 宽85cm, 深75cm
  '\u91d1\u725b\u5ea74.2 240/320/360/400kW': { widthM: 1, heightM: 0.85 }, // 金牛座4.2 240/320/360/400kW: 宽1m, 深85cm
  '\u661f\u9a70300/400A': { widthM: 0.4, heightM: 0.3 },                   // 星海300/400A (星驰): 宽40cm, 深30cm
  '\u661f\u6d77600A': { widthM: 0.6, heightM: 0.43 },                      // 星海600A: 宽60cm, 深43cm
  '\u661f\u6d771200A': { widthM: 0.6, heightM: 0.5 },                      // 星海1200A: 宽60cm, 深50cm
  'Halo\u53cc\u5411\u5145\u7535\u68697/11kW': { widthM: 0.3, heightM: 0.2 }, // Halo双向充放电7/11kW: 宽30cm, 深20cm
  '\u53cc\u5b50\u5ea73\u4ee330kW': { widthM: 0.94, heightM: 0.48 },       // 双子座3代30kW: 宽94cm, 深48cm
  '\u53cc\u5b50\u5ea73\u4ee3Pro 120kW': { widthM: 1.1, heightM: 0.7 },    // 双子座3代Pro 120kW: 宽1.1m, 深70cm
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
