import type { TabListEntryRow } from '@/lib/repositories/tabList'

export type SortKey = 'contract_price' | 'contract_date' | 'condition_status' | 'floor'
export type SortDirection = 'asc' | 'desc'
export type LabelFilter = 'all' | 'MAX' | 'MINI' | 'none'
export type ConditionStatus =
  | 'FULL_RENO_INSULATED'
  | 'FULL_RENO_HIGH_DESIGN'
  | 'FULL_REFORM_ALL_EQUIP'
  | 'PARTIAL_REFORM'
  | 'OWNER_OCCUPIED'
  | 'NEEDS_RENOVATION'
  | 'INVESTMENT_PROPERTY'
  | null

export type ComplexOption = {
  id: string
  name: string
  pref: string | null
  city: string | null
  town: string | null
  stationName: string | null
  stationAccessType: string | null
  stationMinutes: number | null
  unitCount: number | null
}

export type EntryRow = TabListEntryRow & {
  id: string
  created_at: string
}

const STATUS_LABELS: Record<Exclude<ConditionStatus, null>, string> = {
  FULL_RENO_INSULATED: 'フルリノベーション+断熱',
  FULL_RENO_HIGH_DESIGN: 'フルリノベーション(デザイン性・快適性良好)',
  FULL_REFORM_ALL_EQUIP: 'フルリフォーム(設備全て交換)',
  PARTIAL_REFORM: '一部リフォーム',
  OWNER_OCCUPIED: '売主居住中（または居住可能な状態）',
  NEEDS_RENOVATION: '改修必要',
  INVESTMENT_PROPERTY: '収益物件',
}

export const STATUS_OPTIONS: { value: Exclude<ConditionStatus, null>; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中（または居住可能な状態）' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

export function parseDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function statusLabel(value: ConditionStatus): string {
  if (!value) return '—'
  return STATUS_LABELS[value] ?? '—'
}
