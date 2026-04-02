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
  contract_date?: string | null
  reins_registered_date?: string | null
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

export type YearlyReferenceSummaryRow = {
  year: number
  meanUnitPrice: number
  contractCount: number
}

export type YearGrowthCoefResult = {
  value: number | null
  reason: string | null
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

export function resolveMeanReferenceCoef(params: {
  rows: ReferenceValueEntry[]
  maxFloor: number | null
  floor: number | null
  condition?: ConditionStatus
}): number | null {
  const { rows, maxFloor, floor, condition = 'FULL_REFORM_ALL_EQUIP' } = params
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor <= 0) return null

  const { meanRows } = buildReferenceValueTables({ rows, maxFloor })
  return meanRows.find((row) => row.floor === floor)?.values[condition].coef ?? null
}

export function resolveMaxReferenceValue(params: {
  rows: ReferenceValueEntry[]
  maxFloor: number | null
  floor: number | null
  condition?: ConditionStatus
}): number | null {
  const { rows, maxFloor, floor, condition = 'FULL_REFORM_ALL_EQUIP' } = params
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor <= 0) return null

  const { maxRows } = buildReferenceValueTables({ rows, maxFloor })
  return maxRows.find((row) => row.floor === floor)?.values[condition].value ?? null
}

function extractContractYear(value: string | null | undefined): number | null {
  if (!value) return null
  const yearText = value.slice(0, 4)
  const year = Number.parseInt(yearText, 10)
  return Number.isFinite(year) ? year : null
}

function resolveReferenceEventDate(row: ReferenceValueEntry): string | null {
  return row.contract_date ?? row.reins_registered_date ?? null
}

export function buildYearlyReferenceSummaries(rows: ReferenceValueEntry[]): YearlyReferenceSummaryRow[] {
  const grouped = new Map<number, number[]>()

  for (const row of rows) {
    const year = extractContractYear(row.contract_date)
    const unitPrice = resolveReferenceUnitPrice(row)
    if (year == null || unitPrice == null) continue

    const values = grouped.get(year) ?? []
    values.push(unitPrice)
    grouped.set(year, values)
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => ({
      year,
      meanUnitPrice: Math.round(values.reduce((sum, current) => sum + current, 0) / values.length),
      contractCount: values.length,
    }))
}

export function resolveYearGrowthCoefResult(params: {
  rows: ReferenceValueEntry[]
  floor: number | null
  condition?: ConditionStatus
}): YearGrowthCoefResult {
  const { rows, floor, condition = 'FULL_REFORM_ALL_EQUIP' } = params
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor <= 0) {
    return { value: null, reason: '階数を入力すると年数係数を計算できます' }
  }

  const floorReferenceRows = rows
    .filter((row) => row.condition_status === condition && row.floor === floor)
    .map((row) => ({ row, unitPrice: resolveReferenceUnitPrice(row) }))
    .filter((item) => item.unitPrice != null)
    .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))

  const baseDate = floorReferenceRows[0] ? resolveReferenceEventDate(floorReferenceRows[0].row) : null
  const baseYear = extractContractYear(baseDate)
  if (baseYear == null) {
    return { value: null, reason: '該当階・フルリフォームのMAX事例に成約日またはレインズ成約年月日がありません' }
  }

  const yearlyRows = buildYearlyReferenceSummaries(rows)
  if (yearlyRows.length < 2) {
    return { value: null, reason: '年度別平均㎡単価の表に2年分以上のデータがありません' }
  }

  const oldest = yearlyRows[0]
  const latest = yearlyRows[yearlyRows.length - 1]
  const elapsedYears = latest.year - oldest.year
  if (elapsedYears <= 0 || oldest.meanUnitPrice <= 0) {
    return { value: null, reason: '年度別平均㎡単価の比較に必要な基準データが不足しています' }
  }

  const yearsFromBase = latest.year - baseYear
  if (yearsFromBase <= 0) {
    return { value: 0, reason: null }
  }

  const growthRatio = Math.round((latest.meanUnitPrice / oldest.meanUnitPrice) * 10) / 10
  const annualGrowth = Math.round((growthRatio / elapsedYears) * 100) / 100
  return {
    value: Math.round(annualGrowth * yearsFromBase * 100) / 100,
    reason: null,
  }
}

export function resolveYearGrowthCoef(params: {
  rows: ReferenceValueEntry[]
  floor: number | null
  condition?: ConditionStatus
}): number | null {
  return resolveYearGrowthCoefResult(params).value
}
