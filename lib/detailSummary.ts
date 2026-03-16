import { buildFloorRows } from './stockPricing.ts'

export type DetailRowLike = {
  estate_name: string | null
  addr1: string | null
  addr2: string | null
  max_price: number | null
  area_sqm: number | null
  coef_total: number | null
  past_min: number | null
  interior_level_coef: number | null
  contract_year_coef: number | null
}

export type DetailComputed = {
  name: string
  addr: string
  area: number
  unit: number
  targetClose: number
  raise: number
  pastMin: number
  interior: number
  yearCoef: number
  coefSum: number
  buyTarget: number
}

export function safeNumberOr(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function formatJaDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ja-JP')
}

export function formatYenNumber(value: number): string {
  return value.toLocaleString('ja-JP')
}

export function buildDetailSummary(row: DetailRowLike): DetailComputed {
  const name = (row.estate_name ?? '').trim() || '(名称未設定)'
  const addr = [row.addr1 ?? '', row.addr2 ?? ''].filter(Boolean).join(' ')
  const area = safeNumberOr(row.area_sqm, 0)
  const pastMax = safeNumberOr(row.max_price, 0)
  const unit = area > 0 ? Math.round(pastMax / area) : 0
  const coef = safeNumberOr(row.coef_total, 1)
  const [floorRow] = buildFloorRows(unit, coef, area, null)
  const pastMin = safeNumberOr(row.past_min, 0)
  const interior = safeNumberOr(row.interior_level_coef, 0)
  const yearCoef = safeNumberOr(row.contract_year_coef, 0)
  const coefSum = interior + yearCoef

  return {
    name,
    addr,
    area,
    unit,
    targetClose: floorRow?.targetClose ?? 0,
    raise: floorRow?.raise ?? 0,
    pastMin,
    interior,
    yearCoef,
    coefSum,
    buyTarget: floorRow?.buyTarget ?? 0,
  }
}
