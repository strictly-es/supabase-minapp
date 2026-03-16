export type ElevatorChoice = 'あり' | 'なし' | 'スキップ'

export type EffectivePriceLike = {
  contract_price?: number | null
  max_price?: number | null
  past_min?: number | null
}

export type EffectiveUnitPriceLike = EffectivePriceLike & {
  area_sqm?: number | null
  unit_price?: number | null
}

export function toIntOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function toFloatOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function toDateInputValue(value: string | null): string {
  if (!value) return ''
  return value.includes('T') ? value.slice(0, 10) : value
}

export function toMonthInputValue(value: string | null): string {
  if (!value) return ''
  const datePart = value.includes('T') ? value.slice(0, 10) : value
  return datePart.slice(0, 7)
}

export function toDateOrNull(value: string): string | null {
  return value ? value : null
}

export function monthToDateOrNull(value: string): string | null {
  return value ? `${value}-01` : null
}

export function elevatorChoiceToDb(value: ElevatorChoice): boolean | null {
  if (value === 'あり') return true
  if (value === 'なし') return false
  return null
}

export function calcUnitPrice(price: number | null | undefined, area: number | null | undefined): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) return null
  return Math.round((price / area) * 100) / 100
}

export function calcUnitPriceFromStrings(price: string, area: string): number | null {
  return calcUnitPrice(toFloatOrNull(price), toFloatOrNull(area))
}

export function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function diffDays(start: string | null, end: string | null): number | null {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
}

export function calcElapsedDays(start: string, end: string): number | null {
  if (!start || !end) return null
  return diffDays(`${start}T00:00:00`, `${end}T00:00:00`)
}

export function effectivePrice(row: EffectivePriceLike): number | null {
  if (typeof row.contract_price === 'number' && Number.isFinite(row.contract_price)) return row.contract_price
  if (typeof row.max_price === 'number' && Number.isFinite(row.max_price)) return row.max_price
  if (typeof row.past_min === 'number' && Number.isFinite(row.past_min)) return row.past_min
  return null
}

export function effectiveUnitPrice(row: EffectiveUnitPriceLike): number | null {
  if (typeof row.unit_price === 'number' && Number.isFinite(row.unit_price)) return row.unit_price
  return calcUnitPrice(effectivePrice(row), row.area_sqm)
}

export function formatUnitPrice(value: number | null): string {
  if (value == null) return '—'
  return `${value.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}円/㎡`
}
