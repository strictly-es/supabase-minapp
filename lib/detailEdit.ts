import { toFloatOrNull, toIntOrNull } from './entryMath.ts'

export type DetailEditPref = '' | '兵庫' | '大阪'
export type DetailElevatorChoice = '' | '有' | '無'

export type DetailEditForm = {
  estate_name: string
  management: string
  pref: DetailEditPref
  addr1: string
  addr2: string
  floor: string
  elevator: DetailElevatorChoice
  reins_registered_date: string
  contract_date: string
  max_price: string
  area_sqm: string
  coef_total: string
  interior_level_coef: string
  contract_year_coef: string
  past_min: string
}

export function toHasElevator(value: DetailElevatorChoice): boolean | null {
  if (value === '有') return true
  if (value === '無') return false
  return null
}

export function formatInteriorLevelCoef(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return value >= 1 ? value.toFixed(2) : (1 + value).toFixed(2)
}

export function buildDetailEditPayload(form: DetailEditForm, mysokuPdfPath?: string | null): Record<string, unknown> {
  const interior = toFloatOrNull(form.interior_level_coef) ?? 0
  const year = toFloatOrNull(form.contract_year_coef) ?? 0
  const payload: Record<string, unknown> = {
    estate_name: form.estate_name.trim(),
    management: form.management.trim() || null,
    pref: (form.pref || null) as DetailEditPref | null,
    addr1: form.addr1.trim() || null,
    addr2: form.addr2.trim() || null,
    floor: toIntOrNull(form.floor),
    has_elevator: toHasElevator(form.elevator),
    reins_registered_date: form.reins_registered_date || null,
    contract_date: form.contract_date || null,
    max_price: toIntOrNull(form.max_price),
    area_sqm: toFloatOrNull(form.area_sqm),
    coef_total: interior + year,
    interior_level_coef: toFloatOrNull(form.interior_level_coef),
    contract_year_coef: toFloatOrNull(form.contract_year_coef),
    past_min: toIntOrNull(form.past_min),
  }
  if (typeof mysokuPdfPath !== 'undefined') payload.mysoku_pdf_path = mysokuPdfPath
  return payload
}
