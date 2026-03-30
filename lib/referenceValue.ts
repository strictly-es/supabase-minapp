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

export type ReferenceValueMatrixColumn = {
  key: ConditionStatus
  label: string
}

export type ReferenceValueMatrixCell = {
  value: number | null
  coef: number | null
}

export type ReferenceValueMatrixRow = {
  floor: number
  values: Record<ConditionStatus, ReferenceValueMatrixCell>
}

export const FLOOR_COEF_BASE_UNIT_PRICE = 200000

export const CONDITION_STATUS_OPTIONS: { value: ConditionStatus; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中（または居住可能な状態）' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

export const REFERENCE_VALUE_MATRIX_COLUMNS: ReferenceValueMatrixColumn[] = [
  { key: 'FULL_RENO_INSULATED', label: 'フルリノベ++断熱' },
  { key: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベ' },
  { key: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム' },
  { key: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { key: 'OWNER_OCCUPIED', label: '居住中' },
  { key: 'NEEDS_RENOVATION', label: '改修必要' },
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

function roundReferenceValue(value: number): number {
  return Math.round(value)
}

function calcReferenceCoef(value: number | null, base: number | null): number | null {
  if (value == null || base == null || base === 0) return null
  return Math.round((value / base) * 100) / 100
}

function buildConditionFloorMeanMap(rows: ReferenceValueEntry[]): Map<ConditionStatus, Map<number, number>> {
  const grouped = new Map<ConditionStatus, Map<number, number[]>>()

  for (const row of rows) {
    const unitPrice = resolveReferenceUnitPrice(row)
    if (unitPrice == null) continue
    if (row.condition_status == null) continue
    if (typeof row.floor !== 'number' || !Number.isFinite(row.floor)) continue

    const floorMap = grouped.get(row.condition_status) ?? new Map<number, number[]>()
    const values = floorMap.get(row.floor) ?? []
    values.push(unitPrice)
    floorMap.set(row.floor, values)
    grouped.set(row.condition_status, floorMap)
  }

  return new Map(
    [...grouped.entries()].map(([status, floorMap]) => [
      status,
      new Map(
        [...floorMap.entries()].map(([floor, values]) => [
          floor,
          roundReferenceValue(values.reduce((sum, current) => sum + current, 0) / values.length),
        ]),
      ),
    ]),
  )
}

function buildConditionFloorMaxMap(rows: ReferenceValueEntry[]): Map<ConditionStatus, Map<number, number>> {
  const grouped = new Map<ConditionStatus, Map<number, number[]>>()

  for (const row of rows) {
    const unitPrice = resolveReferenceUnitPrice(row)
    if (unitPrice == null) continue
    if (row.condition_status == null) continue
    if (typeof row.floor !== 'number' || !Number.isFinite(row.floor)) continue

    const floorMap = grouped.get(row.condition_status) ?? new Map<number, number[]>()
    const values = floorMap.get(row.floor) ?? []
    values.push(unitPrice)
    floorMap.set(row.floor, values)
    grouped.set(row.condition_status, floorMap)
  }

  return new Map(
    [...grouped.entries()].map(([status, floorMap]) => [
      status,
      new Map(
        [...floorMap.entries()].map(([floor, values]) => [
          floor,
          roundReferenceValue(Math.max(...values)),
        ]),
      ),
    ]),
  )
}

export function buildReferenceValueTables(params: {
  rows: ReferenceValueEntry[]
  maxFloor: number | null
}): {
  maxRows: ReferenceValueMatrixRow[]
  meanRows: ReferenceValueMatrixRow[]
} {
  const { rows, maxFloor } = params
  const floorSummaries = buildReferenceValueSummaries(rows).floorSummaries
  const fallbackMaxFloor = floorSummaries.reduce((highest, row) => Math.max(highest, row.floor), 1)
  const totalFloors = typeof maxFloor === 'number' && Number.isFinite(maxFloor) && maxFloor > 0
    ? Math.floor(maxFloor)
    : fallbackMaxFloor

  const conditionFloorMaxMap = buildConditionFloorMaxMap(rows)
  const conditionFloorMeanMap = buildConditionFloorMeanMap(rows)
  const firstFloorMaxByCondition = new Map(
    REFERENCE_VALUE_MATRIX_COLUMNS.map((column) => [
      column.key,
      conditionFloorMaxMap.get(column.key)?.get(1) ?? null,
    ]),
  )
  const firstFloorMeanByCondition = new Map(
    REFERENCE_VALUE_MATRIX_COLUMNS.map((column) => [
      column.key,
      conditionFloorMeanMap.get(column.key)?.get(1) ?? null,
    ]),
  )

  const buildRows = (kind: 'max' | 'mean'): ReferenceValueMatrixRow[] => Array.from({ length: totalFloors }, (_, index) => {
    const floor = index + 1
    const values = Object.fromEntries(
      CONDITION_STATUS_OPTIONS.map((option) => {
        if (kind === 'max') {
          const value = conditionFloorMaxMap.get(option.value)?.get(floor) ?? null
          return [
            option.value,
            {
              value,
              coef: calcReferenceCoef(value, firstFloorMaxByCondition.get(option.value) ?? null),
            },
          ]
        }

        const value = conditionFloorMeanMap.get(option.value)?.get(floor) ?? null
        return [
          option.value,
          {
            value,
            coef: calcReferenceCoef(value, firstFloorMeanByCondition.get(option.value) ?? null),
          },
        ]
      }),
    ) as Record<ConditionStatus, ReferenceValueMatrixCell>

    return { floor, values }
  })

  return {
    maxRows: buildRows('max'),
    meanRows: buildRows('mean'),
  }
}
