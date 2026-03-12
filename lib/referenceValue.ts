export type ConditionStatus =
  | 'FULL_RENO_INSULATED'
  | 'FULL_RENO_HIGH_DESIGN'
  | 'FULL_REFORM_ALL_EQUIP'
  | 'PARTIAL_REFORM'
  | 'OWNER_OCCUPIED'
  | 'NEEDS_RENOVATION'
  | 'INVESTMENT_PROPERTY'

export type ReferenceValueEntry = {
  condition_status: ConditionStatus | null
  floor: number | null
  unit_price: number | null
  contract_price: number | null
  area_sqm: number | null
}

export type ConditionSummaryRow = {
  key: ConditionStatus
  label: string
  max: number | null
  mean: number | null
}

export type FloorSummaryRow = {
  floor: number
  max: number | null
  mean: number | null
  coef: number | null
}

export const FLOOR_COEF_BASE_UNIT_PRICE = 200000

export const CONDITION_STATUS_OPTIONS: { value: ConditionStatus; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

function calcDerivedUnitPrice(contractPrice: number | null, areaSqm: number | null): number | null {
  if (typeof contractPrice !== 'number' || !Number.isFinite(contractPrice)) return null
  if (typeof areaSqm !== 'number' || !Number.isFinite(areaSqm) || areaSqm <= 0) return null
  return Math.round((contractPrice / areaSqm) * 100) / 100
}

export function resolveReferenceUnitPrice(row: ReferenceValueEntry): number | null {
  if (typeof row.unit_price === 'number' && Number.isFinite(row.unit_price)) return row.unit_price
  return calcDerivedUnitPrice(row.contract_price, row.area_sqm)
}

export function buildReferenceValueSummaries(rows: ReferenceValueEntry[]): {
  conditionSummaries: ConditionSummaryRow[]
  floorSummaries: FloorSummaryRow[]
} {
  const grouped = new Map<ConditionStatus, number[]>()
  const floorGrouped = new Map<number, number[]>()

  for (const row of rows) {
    const unitPrice = resolveReferenceUnitPrice(row)
    if (unitPrice == null) continue

    if (row.condition_status) {
      const list = grouped.get(row.condition_status) ?? []
      list.push(unitPrice)
      grouped.set(row.condition_status, list)
    }

    if (typeof row.floor === 'number' && Number.isFinite(row.floor)) {
      const floorList = floorGrouped.get(row.floor) ?? []
      floorList.push(unitPrice)
      floorGrouped.set(row.floor, floorList)
    }
  }

  const conditionSummaries = CONDITION_STATUS_OPTIONS.map((option) => {
    const values = grouped.get(option.value) ?? []
    if (values.length === 0) return { key: option.value, label: option.label, max: null, mean: null }
    const max = Math.max(...values)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return { key: option.value, label: option.label, max, mean }
  })

  const floorSummaries = [...new Set<number>([1, ...floorGrouped.keys()])]
    .sort((a, b) => b - a)
    .map((floor) => {
      const values = floorGrouped.get(floor) ?? []
      const max = values.length > 0 ? Math.max(...values) : null
      const mean = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      const coef = floor === 1
        ? 1
        : (mean != null ? Math.round((mean / FLOOR_COEF_BASE_UNIT_PRICE) * 100) / 100 : null)

      return { floor, max, mean, coef }
    })

  return { conditionSummaries, floorSummaries }
}
