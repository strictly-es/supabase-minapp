import type { ChangeEvent } from 'react'
import type { DetailEditForm, DetailEditPref } from '@/lib/detailEdit'

export type Pref = DetailEditPref

export type Row = {
  id: string
  estate_name: string | null
  management: string | null
  pref: Pref | null
  addr1: string | null
  addr2: string | null
  max_price: number | null
  area_sqm: number | null
  coef_total: number | null
  past_min: number | null
  reins_registered_date: string | null
  contract_date: string | null
  floor: number | null
  has_elevator: boolean | null
  mysoku_pdf_path: string | null
  interior_level_coef: number | null
  contract_year_coef: number | null
}

export type FormState = DetailEditForm

export type DetailFormChangeHandler = <K extends keyof FormState>(
  key: K,
) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
