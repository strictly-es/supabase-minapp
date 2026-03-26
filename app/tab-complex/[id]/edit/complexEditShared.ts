import type { ChangeEvent } from 'react'
import type { ReferenceValueEntry } from '@/lib/referenceValue'

export type Pref = '' | '東京' | '神奈川' | '千葉' | '埼玉' | '大阪' | '兵庫'
export type Access = '' | '徒歩' | 'バス' | '車・その他'
export type BuildingStructure = '' | 'SRC' | 'RC' | '鉄骨造' | '木造'

export type ComplexForm = {
  name: string
  pref: Pref
  city: string
  town: string
  mapUrl: string
  builtYm: string
  unitCount: string
  stationName: string
  stationAccess: Access
  stationMinutes: string
  seller: string
  builder: string
  mgmtCompany: string
  mgmtType: '' | '自主管理' | '一部委託' | '全部委託'
  buildingStructure: BuildingStructure
  floorCount: string
  sameAddressNewSeismicCase: string
  sameAddressOldSeismicCase: string
  sameStationNewSeismicCase: string
  sameStationOldSeismicCase: string
}

export type EvalOption = { value: string; label: string; score: number }
export type EvalState = {
  marketDeals: string
  rentDemand: string
  inventory: string
  walk: string
  access: string
  convenience: string
  scale: string
  elevator: string
  mgmt: string
  appearance: string
  parking: string
  view: string
  future: string
  focus: string
  support: string
  comment: string
}

export type MarketDealsValue = 'rich' | 'normal' | 'low' | 'unregistered'
export type MarketDealsAutoState = {
  value: MarketDealsValue
  contractCount: number
  averagePerYear: number | null
  ratioPerUnit: number | null
}

export type CategoryTotals = {
  market: number
  loc: number
  bld: number
  plus: number
}

export type EvalOptionsMap = Record<keyof Omit<EvalState, 'comment'>, EvalOption[]>

export type ComplexChangeHandler = <K extends keyof ComplexForm>(
  key: K,
) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void

export type EvalChangeHandler = <K extends keyof EvalState>(
  key: K,
) => (e: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => void

export type ReferenceSummaryProps = {
  referenceRows: ReferenceValueEntry[]
  maxFloor: number | null
}

export const prefOptions: Pref[] = ['東京', '神奈川', '千葉', '埼玉', '大阪', '兵庫', '']
