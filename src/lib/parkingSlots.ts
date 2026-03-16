import type { ParkingParams, ParkingSlot, SceneDocument, SceneElement } from '../types/scene'

export function normalizeSteelColor(color: string | undefined) {
  const raw = (color ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toUpperCase()
  }
  return '#FFFFFF'
}

export function createParkingSlots(count: number): ParkingSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    index,
    children: [],
  }))
}

export function syncParkingSlots(
  slots: ParkingSlot[] | undefined,
  count: number,
): ParkingSlot[] {
  const safeCount = Math.max(1, Math.round(count || 1))
  const baseSlots = (slots ?? []).slice(0, safeCount).map((slot, index) => ({
    ...slot,
    index,
    children: slot.children ?? [],
  }))

  if (baseSlots.length >= safeCount) {
    return baseSlots
  }

  return [
    ...baseSlots,
    ...Array.from({ length: safeCount - baseSlots.length }, (_, offset) => ({
      id: crypto.randomUUID(),
      index: baseSlots.length + offset,
      children: [],
    })),
  ]
}

export function normalizeParkingParams(params: ParkingParams): ParkingParams {
  const count = Math.max(1, Math.round(params.count ?? params.slots?.length ?? 1))
  return {
    ...params,
    count,
    carportStyle: params.carportStyle ?? 'y',
    steelColor: normalizeSteelColor(params.steelColor),
    slots: syncParkingSlots(params.slots, count),
  }
}

export function normalizeSceneDocument(scene: SceneDocument): SceneDocument {
  return {
    ...scene,
    elements: scene.elements.map((element) => normalizeSceneElement(element)),
  }
}

export function normalizeSceneElement(element: SceneElement): SceneElement {
  if (element.type !== 'parking') {
    return element
  }

  return {
    ...element,
    params: normalizeParkingParams(element.params as ParkingParams),
  }
}
