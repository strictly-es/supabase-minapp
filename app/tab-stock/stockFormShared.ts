import type { ChangeEvent } from 'react'
import type { FloorRow } from '@/lib/stockPricing'
import type { ReferenceValueEntry } from '@/lib/referenceValue'

export type StockComplexOption = {
  id: string
  name: string
  pref: string | null
  city: string | null
  floorPattern: string | null
  floorCount?: number | null
}

export type StockEntryOption = {
  id: string
  floor: number | null
  area: number | null
  layout: string | null
  maxPrice: number | null
  coefTotal: number | null
  interiorCoef?: number | null
  yearCoef?: number | null
  reins?: string | null
  contract: string | null
}

export type StockFormState = {
  floor: string
  area: string
  layout: string
  registered: string
  contract?: string
  maxUnit: string
  yearCoef: string
  coefTotal: string
}

export type StockFormChangeHandler = <K extends keyof StockFormState>(
  key: K,
) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void

export type ExistingPdfLink = {
  path: string | null
  url: string | null
}

export type StockFormProps = {
  selectedComplexId: string
  complexes: StockComplexOption[]
  selectedEntryId: string
  entries: StockEntryOption[]
  selectedComplex: StockComplexOption | null
  selectedEntry: StockEntryOption | null
  form: StockFormState
  floors: FloorRow[]
  selectedFloorNum: number | null
  referenceRows: ReferenceValueEntry[]
  saving: boolean
  submitLabel: string
  resetLabel?: string
  showContractDate?: boolean
  showOnlySelectedFloorRow?: boolean
  existingPdf?: ExistingPdfLink | null
  onComplexChange: (complexId: string) => void
  onEntryChange: (entryId: string) => void
  onFormChange: StockFormChangeHandler
  onPdfChange: (file: File | null) => void
  onReset: () => void
}
