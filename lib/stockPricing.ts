export type FloorPattern = '①保守的' | '②中間' | '③攻め' | '④超攻め'

export type FloorRow = {
  floor: number
  floorCoef: number
  targetUnit: number
  targetClose: number
  raise: number
  buyTarget: number
}

export const FLOOR_COEFS: Record<FloorPattern, number[]> = {
  '①保守的': [1.0, 0.98, 0.95, 0.9, 0.85],
  '②中間': [1.0, 0.99, 0.96, 0.92, 0.88],
  '③攻め': [1.0, 1.0, 0.99, 0.98, 0.97],
  '④超攻め': [0.98, 0.99, 1.0, 1.03, 1.07],
}

export function safeNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function getFloorCoefs(pattern: string | null | undefined): number[] {
  if (pattern && pattern in FLOOR_COEFS) {
    return FLOOR_COEFS[pattern as FloorPattern]
  }
  return [1, 1, 1, 1, 1]
}

export function calcMoveCost(area: number): number {
  if (area < 60) return Math.round(area * 132000)
  if (area >= 80) return Math.round(area * 123000)
  return Math.round(area * (132000 - (area - 60) * 400))
}

export function calcBrokerage(raise: number): number {
  if (raise < 10_000_000) return 550_000
  return Math.round(raise * 0.055)
}

export function calcOtherCost(raise: number): number {
  return Math.round(raise * 0.075)
}

export function buildFloorRows(baseUnit: number, baseCoef: number, area: number, pattern: string | null | undefined): FloorRow[] {
  return getFloorCoefs(pattern).map((floorCoef, index) => {
    const targetUnit = Math.round(baseUnit * baseCoef * floorCoef)
    const targetClose = Math.round(targetUnit * area)
    const raise = Math.floor((targetClose / 1.21) / 10000) * 10000
    const moveCost = calcMoveCost(area)
    const brokerage = calcBrokerage(raise)
    const other = calcOtherCost(raise)
    const buyTarget = raise - moveCost - brokerage - other

    return {
      floor: index + 1,
      floorCoef,
      targetUnit,
      targetClose,
      raise,
      buyTarget,
    }
  })
}

export function calcBaseUnitPrice(maxPrice: number | null, area: number | null): string {
  if (typeof maxPrice !== 'number' || !Number.isFinite(maxPrice)) return ''
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) return ''
  return String(Math.round(maxPrice / area))
}

export function toNumberString(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export function toFixedString(value: number | null, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : fallback
}

export function formatYen(value: number): string {
  return `${value.toLocaleString('ja-JP')} 円`
}

export function formatUnit(value: number): string {
  return `${formatYen(value)}/㎡`
}
