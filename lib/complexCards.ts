import { calcUnitPrice, diffDays } from './entryMath.ts'
import { diffFromBaseDateDays, shouldShowStockTimingAlert } from './stockTimingAlert.ts'

export type FactorItem = { score?: number }
export type Factors = {
  market?: { deals?: FactorItem; rentDemand?: FactorItem; inventory?: FactorItem }
  location?: { walk?: FactorItem; access?: FactorItem; convenience?: FactorItem }
  building?: { scale?: FactorItem; elevator?: FactorItem; mgmt?: FactorItem; appearance?: FactorItem; parking?: FactorItem; view?: FactorItem }
  plus?: { future?: FactorItem; focus?: FactorItem; support?: FactorItem }
}

export type ComplexEvaluation = {
  id: string
  total_score: number | null
  factors: Record<string, unknown> | null
  created_at: string
}

export type ComplexRow = {
  id: string
  name: string
  pref: string | null
  city: string | null
  town: string | null
  built_ym: string | null
  built_age: number | null
  station_name: string | null
  station_access_type: string | null
  station_minutes: number | null
  unit_count: number | null
  has_elevator: boolean | null
  floor_coef_pattern: string | null
  complex_evaluations?: ComplexEvaluation[]
}

export type EntrySummaryRow = {
  complex_id: string
  contract_kind: 'MAX' | 'MINI' | null
  max_price: number | null
  past_min: number | null
  area_sqm: number | null
  reins_registered_date: string | null
  contract_date: string | null
}

export type StockSummaryRow = {
  complex_id: string | null
  registered_date: string | null
}

export type Card = {
  id: string
  name: string
  pref: string
  addr: string
  station: string
  built: string
  builtAge: number | null
  units: string
  score: number | null
  hasElevator: boolean
  floorPattern: string
  area: number | null
  market: number | null
  loc: number | null
  bld: number | null
  plus: number | null
  maxPrice: number | null
  maxUnitPrice: number | null
  miniPrice: number | null
  miniUnitPrice: number | null
  miniElapsedDays: number | null
  stockCount: number
  stockDaysOldest: number | null
  stockAlertDays: number | null
  showStockTimingAlert: boolean
}

export function formatAddr(pref: string | null, city: string | null, town: string | null): string {
  return [pref ?? '', city ?? '', town ?? ''].filter(Boolean).join(' ')
}

export function formatStation(name: string | null, access: string | null, minutes: number | null): string {
  if (!name) return ''
  const walk = minutes ? `${access ?? ''}${minutes}分` : access ?? ''
  return `最寄: ${name}${walk ? ` (${walk})` : ''}`
}

export function formatBuilt(ym: string | null, age: number | null): string {
  if (!ym && age == null) return ''
  const formattedYm = ym ? ym.replace('-', '/') : ''
  return `${formattedYm}${age != null ? ` (築${age}年)` : ''}`.trim()
}

export function normalizePref(pref: string | null): string {
  if (!pref) return ''
  return pref.replace(/(都|道|府|県)$/u, '')
}

export function pickScore(item?: FactorItem): number {
  if (!item || typeof item !== 'object') return 0
  return typeof item.score === 'number' ? item.score : 0
}

export function toValidNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatYenOrDash(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value).toLocaleString('ja-JP')}円`
}

export function summarizeEntries(entryRows: EntrySummaryRow[]) {
  const areaByComplex = new Map<string, number>()
  const maxDealByComplex = new Map<string, { price: number | null; unitPrice: number | null }>()
  const miniDealByComplex = new Map<string, { price: number | null; unitPrice: number | null; elapsedDays: number | null }>()

  for (const row of entryRows) {
    if (!row.complex_id) continue
    const area = toValidNumber(row.area_sqm)
    if (area != null && !areaByComplex.has(row.complex_id)) areaByComplex.set(row.complex_id, area)

    if (row.contract_kind === 'MAX' && !maxDealByComplex.has(row.complex_id)) {
      maxDealByComplex.set(row.complex_id, {
        price: toValidNumber(row.max_price),
        unitPrice: calcUnitPrice(row.max_price, row.area_sqm),
      })
    }

    if (row.contract_kind === 'MINI' && !miniDealByComplex.has(row.complex_id)) {
      miniDealByComplex.set(row.complex_id, {
        price: toValidNumber(row.past_min),
        unitPrice: calcUnitPrice(row.past_min, row.area_sqm),
        elapsedDays: diffDays(row.reins_registered_date, row.contract_date),
      })
    }
  }

  return { areaByComplex, maxDealByComplex, miniDealByComplex }
}

export function summarizeStocks(stockRows: StockSummaryRow[]) {
  const stockCountByComplex = new Map<string, number>()
  const oldestRegisteredByComplex = new Map<string, string>()

  for (const row of stockRows) {
    if (!row.complex_id) continue
    stockCountByComplex.set(row.complex_id, (stockCountByComplex.get(row.complex_id) ?? 0) + 1)
    if (!row.registered_date) continue
    const rowDateMs = new Date(row.registered_date).getTime()
    if (Number.isNaN(rowDateMs)) continue
    const currentOldest = oldestRegisteredByComplex.get(row.complex_id)
    if (!currentOldest || rowDateMs < new Date(currentOldest).getTime()) {
      oldestRegisteredByComplex.set(row.complex_id, row.registered_date)
    }
  }

  return { stockCountByComplex, oldestRegisteredByComplex }
}

export function mapComplexesToCards(
  rows: ComplexRow[],
  entryRows: EntrySummaryRow[],
  stockRows: StockSummaryRow[],
  now: Date = new Date(),
): Card[] {
  const { areaByComplex, maxDealByComplex, miniDealByComplex } = summarizeEntries(entryRows)
  const { stockCountByComplex, oldestRegisteredByComplex } = summarizeStocks(stockRows)

  return rows.map((row) => {
    const evaluations = [...(row.complex_evaluations ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const latest = evaluations[0]
    const factors = (latest?.factors ?? null) as Factors | null
    const market = factors?.market ? pickScore(factors.market.deals) + pickScore(factors.market.rentDemand) + pickScore(factors.market.inventory) : null
    const loc = factors?.location ? pickScore(factors.location.walk) + pickScore(factors.location.access) + pickScore(factors.location.convenience) : null
    const bld = factors?.building
      ? pickScore(factors.building.scale) + pickScore(factors.building.elevator) + pickScore(factors.building.mgmt) + pickScore(factors.building.appearance) + pickScore(factors.building.parking) + pickScore(factors.building.view)
      : null
    const plus = factors?.plus ? pickScore(factors.plus.future) + pickScore(factors.plus.focus) + pickScore(factors.plus.support) : null
    const maxDeal = maxDealByComplex.get(row.id)
    const miniDeal = miniDealByComplex.get(row.id)
    const stockCount = stockCountByComplex.get(row.id) ?? 0
    const stockDaysOldest = diffFromBaseDateDays(oldestRegisteredByComplex.get(row.id) ?? null, now)
    const { stockAlertDays, showStockTimingAlert } = shouldShowStockTimingAlert({
      stockCount,
      stockDaysOldest,
      miniElapsedDays: miniDeal?.elapsedDays ?? null,
    })

    return {
      id: row.id,
      name: row.name,
      pref: row.pref ?? '',
      addr: formatAddr(row.pref, row.city, row.town),
      station: formatStation(row.station_name, row.station_access_type, row.station_minutes),
      built: formatBuilt(row.built_ym, row.built_age),
      builtAge: row.built_age ?? null,
      units: row.unit_count != null ? `${row.unit_count}戸` : '',
      score: latest?.total_score ?? null,
      hasElevator: row.has_elevator ?? false,
      floorPattern: row.floor_coef_pattern ?? '',
      area: areaByComplex.get(row.id) ?? null,
      market,
      loc,
      bld,
      plus,
      maxPrice: maxDeal?.price ?? null,
      maxUnitPrice: maxDeal?.unitPrice ?? null,
      miniPrice: miniDeal?.price ?? null,
      miniUnitPrice: miniDeal?.unitPrice ?? null,
      miniElapsedDays: miniDeal?.elapsedDays ?? null,
      stockCount,
      stockDaysOldest,
      stockAlertDays,
      showStockTimingAlert,
    }
  })
}
