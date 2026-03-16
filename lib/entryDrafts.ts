import {
  calcUnitPriceFromStrings,
  effectivePrice,
  elevatorChoiceToDb,
  monthToDateOrNull,
  toDateInputValue,
  toDateOrNull,
  toFloatOrNull,
  toIntOrNull,
  toMonthInputValue,
} from './entryMath.ts'

export type DealLabel = '' | 'MAX' | 'MINI'
export type EntryContractKind = 'MAX' | 'MINI' | null
export type EntryElevatorChoice = 'あり' | 'なし' | 'スキップ'

export type EntryDraft = {
  contract_kind: DealLabel
  has_elevator: EntryElevatorChoice
  built_month: string
  building_no: string
  floor: string
  contract_price: string
  area_sqm: string
  reins_registered_date: string
  contract_date: string
  condition_status: string
}

export type EntryDraftRow = {
  contract_kind: EntryContractKind
  has_elevator: boolean | null
  built_month: string | null
  building_no: number | null
  floor: number | null
  contract_price: number | null
  area_sqm: number | null
  reins_registered_date: string | null
  contract_date: string | null
  condition_status: string | null
  max_price: number | null
  past_min: number | null
  unit_price?: number | null
}

export function rowToDraft(row: EntryDraftRow): EntryDraft {
  return {
    contract_kind: row.contract_kind ?? '',
    has_elevator: row.has_elevator === true ? 'あり' : row.has_elevator === false ? 'なし' : 'スキップ',
    built_month: toMonthInputValue(row.built_month),
    building_no: typeof row.building_no === 'number' ? String(row.building_no) : '',
    floor: typeof row.floor === 'number' ? String(row.floor) : '',
    contract_price: (() => {
      const price = effectivePrice(row)
      return typeof price === 'number' ? String(price) : ''
    })(),
    area_sqm: typeof row.area_sqm === 'number' ? String(row.area_sqm) : '',
    reins_registered_date: toDateInputValue(row.reins_registered_date),
    contract_date: toDateInputValue(row.contract_date),
    condition_status: row.condition_status ?? '',
  }
}

export function draftEqualsRow(draft: EntryDraft, row: EntryDraftRow): boolean {
  return JSON.stringify(draft) === JSON.stringify(rowToDraft(row))
}

export function applyDraftToRow<T extends EntryDraftRow>(row: T, draft: EntryDraft | undefined): T {
  if (!draft) return row
  const price = toIntOrNull(draft.contract_price)
  const contractKind = draft.contract_kind || null
  return {
    ...row,
    contract_kind: contractKind,
    has_elevator: elevatorChoiceToDb(draft.has_elevator),
    built_month: monthToDateOrNull(draft.built_month),
    building_no: toIntOrNull(draft.building_no),
    floor: toIntOrNull(draft.floor),
    contract_price: price,
    max_price: contractKind === 'MAX' ? price : null,
    past_min: contractKind === 'MINI' ? price : null,
    area_sqm: toFloatOrNull(draft.area_sqm),
    unit_price: calcUnitPriceFromStrings(draft.contract_price, draft.area_sqm),
    reins_registered_date: toDateOrNull(draft.reins_registered_date),
    contract_date: toDateOrNull(draft.contract_date),
    condition_status: draft.condition_status || null,
  }
}

export function buildLabelSpecificResetPayload(previousKind: EntryContractKind, nextKind: DealLabel) {
  if (previousKind === nextKind) return {}
  if (nextKind === 'MAX') {
    return {
      renovated: null,
    }
  }
  if (nextKind === 'MINI') {
    return {
      coef_total: null,
      interior_level_coef: null,
      contract_year_coef: null,
    }
  }
  return {
    coef_total: null,
    interior_level_coef: null,
    contract_year_coef: null,
    renovated: null,
  }
}
