import { buildSoftDeletePayload } from '../deletePayload.ts'

type RepositoryError = { message: string }
type QueryListResult<T> = Promise<{ data: T[] | null; error: RepositoryError | null }>
type QueryUpdateResult = Promise<{ error: RepositoryError | null }>

type HousingComplexesSelect = {
  select(columns: string): {
    is(column: string, value: null): {
      order(column: string, options: { ascending: boolean }): QueryListResult<Record<string, unknown>>
    }
  }
}

type EstateEntriesSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      is(column: string, value: null): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): QueryListResult<Record<string, unknown>>
        }
      }
    }
  }
  update(payload: Record<string, unknown>): {
    eq(column: string, value: unknown): QueryUpdateResult
  }
}

type EstateEntriesConflictSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): {
        neq(column: string, value: unknown): {
          is(column: string, value: null): {
            limit(count: number): QueryListResult<{ id: string }>
          }
        }
      }
    }
  }
}

type UploadsBucket = {
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string | null } | null; error: RepositoryError | null }>
}

type TabListRepositoryClient = {
  from(table: 'housing_complexes'): HousingComplexesSelect
  from(table: 'estate_entries'): EstateEntriesSelect & EstateEntriesConflictSelect
  storage?: {
    from(bucket: 'uploads'): UploadsBucket
  }
}

type ConditionStatus =
  | 'FULL_RENO_INSULATED'
  | 'FULL_RENO_HIGH_DESIGN'
  | 'FULL_REFORM_ALL_EQUIP'
  | 'PARTIAL_REFORM'
  | 'OWNER_OCCUPIED'
  | 'NEEDS_RENOVATION'
  | 'INVESTMENT_PROPERTY'
  | null

type HousingComplexRow = {
  id: string
  name: string | null
  pref: string | null
  city: string | null
  town: string | null
  station_name: string | null
  station_access_type: string | null
  station_minutes: number | null
  unit_count: number | null
}

type EntryRowRaw = {
  id: string
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  contract_price?: number | null
  unit_price?: number | null
  built_month?: string | null
  building_no?: number | null
  condition_status?: ConditionStatus
  has_elevator: boolean | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  mysoku_pdf_path: string | null
  created_at: string
}

export type TabListComplexOption = {
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

export type TabListEntryRow = {
  id: string
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  contract_price: number | null
  unit_price: number | null
  built_month: string | null
  building_no: number | null
  condition_status: ConditionStatus
  has_elevator: boolean | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  mysoku_pdf_path: string | null
  created_at: string
}

function asTabListRepositoryClient(supabase: unknown): TabListRepositoryClient {
  return supabase as TabListRepositoryClient
}

function mapComplexRow(row: HousingComplexRow): TabListComplexOption {
  return {
    id: row.id,
    name: row.name ?? '(名称未設定)',
    pref: row.pref ?? null,
    city: row.city ?? null,
    town: row.town ?? null,
    stationName: row.station_name ?? null,
    stationAccessType: row.station_access_type ?? null,
    stationMinutes: row.station_minutes ?? null,
    unitCount: row.unit_count ?? null,
  }
}

function mapLegacyEntryRow(row: EntryRowRaw): TabListEntryRow {
  return {
    ...row,
    contract_price: null,
    unit_price: null,
    built_month: null,
    building_no: null,
    condition_status: null,
  }
}

export async function listTabListComplexes(supabase: unknown): Promise<TabListComplexOption[]> {
  const client = asTabListRepositoryClient(supabase)
  const { data, error } = await client
    .from('housing_complexes')
    .select('id, name, pref, city, town, station_name, station_access_type, station_minutes, unit_count')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as HousingComplexRow[]).map(mapComplexRow)
}

export async function listTabListEntries(supabase: unknown, complexId: string): Promise<TabListEntryRow[]> {
  const client = asTabListRepositoryClient(supabase)
  const nextSelect = 'id, contract_kind, floor, area_sqm, contract_price, unit_price, built_month, building_no, condition_status, has_elevator, reins_registered_date, contract_date, max_price, past_min, mysoku_pdf_path, created_at'
  const legacySelect = 'id, contract_kind, floor, area_sqm, has_elevator, reins_registered_date, contract_date, max_price, past_min, mysoku_pdf_path, created_at'

  const { data, error } = await (client.from('estate_entries') as EstateEntriesSelect)
    .select(nextSelect)
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (!error) return (data ?? []) as TabListEntryRow[]

  if (!/column .* does not exist/i.test(error.message)) throw error

  const { data: legacyData, error: legacyError } = await (client.from('estate_entries') as EstateEntriesSelect)
    .select(legacySelect)
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (legacyError) throw legacyError

  return ((legacyData ?? []) as EntryRowRaw[]).map(mapLegacyEntryRow)
}

export async function hasEntryKindConflict(
  supabase: unknown,
  complexId: string,
  contractKind: 'MAX' | 'MINI',
  entryId: string,
): Promise<boolean> {
  const client = asTabListRepositoryClient(supabase)
  const { data, error } = await (client.from('estate_entries') as EstateEntriesConflictSelect)
    .select('id')
    .eq('complex_id', complexId)
    .eq('contract_kind', contractKind)
    .neq('id', entryId)
    .is('deleted_at', null)
    .limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

export async function updateTabListEntry(supabase: unknown, entryId: string, payload: Record<string, unknown>) {
  const client = asTabListRepositoryClient(supabase)
  const { error } = await client.from('estate_entries').update(payload).eq('id', entryId)
  if (error) throw error
}

export async function softDeleteTabListEntry(supabase: unknown, entryId: string, userId?: string | null) {
  const client = asTabListRepositoryClient(supabase)
  const { error } = await client.from('estate_entries').update(buildSoftDeletePayload(userId)).eq('id', entryId)
  if (error) throw error
}

export async function createEntryPdfSignedUrl(supabase: unknown, path: string): Promise<string> {
  const client = asTabListRepositoryClient(supabase)
  if (!client.storage) throw new Error('storage client is not available')
  const { data, error } = await client.storage.from('uploads').createSignedUrl(path, 600)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('PDF URLの生成に失敗しました')
  return data.signedUrl
}
