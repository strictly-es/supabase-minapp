import { buildSoftDeletePayload } from './deletePayload.ts'
import { formatYen, safeNumber } from './stockPricing.ts'

export type StockEntryLike = {
  renovated: boolean | null
  contract_kind: string | null
  estate_name: string | null
}

export type StockRow = {
  id: string
  floor: number | null
  area_sqm: number | null
  layout: string | null
  registered_date: string | null
  contract_date: string | null
  list_price: number | null
  target_unit_price: number | null
  target_close_price: number | null
  buy_target_price: number | null
  raise_price: number | null
  base_unit_price: number | null
  coef_total: number | null
  floor_coef: number | null
  status: string | null
  estate_entries?: StockEntryLike | StockEntryLike[] | null
}

export type StockCard = {
  id: string
  floor: number | null
  area: number
  layout: string
  reg: string
  contract: string
  price: number
  unit: number
  targetUnit: number
  targetPrice: number
  buyTarget: number
  raise: number
  status: string
  days: number
  renovated: boolean | null
}

export function parseDateOrNull(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function diffFromNowDays(value: string | null, now: Date = new Date()): number {
  const date = parseDateOrNull(value)
  if (!date) return 0
  return Math.round(Math.abs(now.getTime() - date.getTime()) / 86400000)
}

export function mapStockRowToCard(row: StockRow, now: Date = new Date()): StockCard {
  const entry = Array.isArray(row.estate_entries) ? (row.estate_entries[0] ?? null) : (row.estate_entries ?? null)
  const area = safeNumber(row.area_sqm)
  const listPrice = safeNumber(row.list_price)
  const unitStored = safeNumber(row.target_unit_price)
  const baseUnit = safeNumber(row.base_unit_price)
  const coef = safeNumber(row.coef_total) || 1
  const floorCoef = safeNumber(row.floor_coef) || 1
  const unit = area > 0 ? Math.round(listPrice / area) : 0
  const targetUnit = unitStored || Math.round(baseUnit * coef * floorCoef)
  const targetPriceStored = safeNumber(row.target_close_price)
  const targetPrice = targetPriceStored || Math.round(targetUnit * area)
  const raiseStored = safeNumber(row.raise_price)
  const raise = raiseStored || Math.floor((targetPrice / 1.21) / 10000) * 10000
  const buyStored = safeNumber(row.buy_target_price)
  const moveCost = area < 60 ? Math.round(area * 132000) : (area >= 80 ? Math.round(area * 123000) : Math.round(area * (132000 - (area - 60) * 400)))
  const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
  const other = Math.round(raise * 0.075)
  const buyTarget = buyStored || (raise - moveCost - brokerage - other)

  return {
    id: row.id,
    floor: row.floor,
    area,
    layout: (row.layout ?? '').trim(),
    reg: row.registered_date ?? '',
    contract: row.contract_date ?? '',
    price: listPrice,
    unit,
    targetUnit,
    targetPrice,
    buyTarget,
    raise,
    status: row.status ?? '未設定',
    days: diffFromNowDays(row.registered_date, now),
    renovated: entry?.renovated ?? null,
  }
}

export function mapStockRowsToCards(rows: StockRow[], now: Date = new Date()): StockCard[] {
  return rows.map((row) => mapStockRowToCard(row, now))
}

export function formatStockYen(value: number): string {
  return formatYen(value)
}

export function buildStockDeletePayload(userId?: string | null, now = new Date()): Record<string, unknown> {
  return buildSoftDeletePayload(userId, now)
}
