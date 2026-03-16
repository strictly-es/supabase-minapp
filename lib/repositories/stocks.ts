import { buildStockDeletePayload, type StockRow } from '../stockCards.ts'
import { safeNumber } from '../stockPricing.ts'

type RepositoryError = { message: string }
type QueryListResult<T> = Promise<{ data: T[] | null; error: RepositoryError | null }>
type QueryInsertResult = Promise<{ error: RepositoryError | null }>
type QueryUpdateResult = Promise<{ error: RepositoryError | null }>
type QueryMaybeSingleResult<T> = Promise<{ data: T | null; error: RepositoryError | null }>

type HousingComplexesSelect = {
  select(columns: string): {
    is(column: string, value: null): {
      order(column: string, options: { ascending: boolean }): QueryListResult<Record<string, unknown>>
    }
  }
}

type EstateStocksSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      is(column: string, value: null): {
        order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): {
          limit(count: number): QueryListResult<Record<string, unknown>>
        }
      }
    }
  }
  insert(payload: Record<string, unknown>): QueryInsertResult
  update(payload: Record<string, unknown>): {
    eq(column: string, value: unknown): QueryUpdateResult
  }
}

type EstateStocksMaybeSingleSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      maybeSingle(): QueryMaybeSingleResult<Record<string, unknown>>
    }
  }
}

type EstateEntriesMaybeSingleSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      maybeSingle(): QueryMaybeSingleResult<Record<string, unknown>>
    }
  }
}

type EstateEntriesSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): {
        is(column: string, value: null): {
          order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): {
            limit(count: number): QueryListResult<Record<string, unknown>>
          }
        }
      }
    }
  }
}

type UploadsBucket = {
  upload(
    path: string,
    file: unknown,
    options: { upsert: boolean; contentType: string },
  ): Promise<{ error: RepositoryError | null }>
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string | null } | null; error: RepositoryError | null }>
}

type StocksRepositoryClient = {
  from(table: 'housing_complexes'): HousingComplexesSelect
  from(table: 'estate_stocks'): EstateStocksSelect & EstateStocksMaybeSingleSelect
  from(table: 'estate_entries'): EstateEntriesSelect & EstateEntriesMaybeSingleSelect
  storage?: {
    from(bucket: 'uploads'): UploadsBucket
  }
}

type StockComplexRow = {
  id: string
  name: string | null
  pref: string | null
  city: string | null
  floor_coef_pattern?: string | null
}

type StockEntryRaw = {
  id: string
  complex_id?: string | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  max_price: number | null
  coef_total: number | null
  interior_level_coef: number | null
  contract_year_coef: number | null
  reins_registered_date: string | null
  contract_date: string | null
  contract_kind?: string | null
}

export type StockDetailRow = {
  id: string
  estate_entry_id: string | null
  floor: number | null
  area_sqm: number | null
  list_price: number | null
  registered_date: string | null
  stock_mysoku_path: string | null
  broker_name: string | null
  broker_pref: string | null
  broker_city: string | null
  broker_town: string | null
  broker_tel: string | null
  broker_person: string | null
  broker_mobile: string | null
  broker_email: string | null
  broker_mysoku_url: string | null
  broker_photo_url: string | null
  fundplan_url: string | null
  status: string | null
}

export type StockEditRow = {
  id: string
  complex_id: string | null
  estate_entry_id: string | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  registered_date: string | null
  contract_date: string | null
  base_unit_price: number | null
  coef_total: number | null
  stock_mysoku_path: string | null
}

export type StockComplexOption = {
  id: string
  name: string
  pref: string | null
  city: string | null
  floorPattern: string | null
}

export type StockRegEntryOption = {
  id: string
  complexId?: string | null
  floor: number | null
  area: number | null
  layout: string | null
  maxPrice: number | null
  coefTotal: number | null
  interiorCoef: number | null
  yearCoef: number | null
  reins: string | null
  contract: string | null
}

export type StockEntryContext = StockRegEntryOption & {
  complexId: string | null
  contractKind: string | null
}

function asStocksRepositoryClient(supabase: unknown): StocksRepositoryClient {
  return supabase as StocksRepositoryClient
}

function mapComplexRow(row: StockComplexRow): StockComplexOption {
  return {
    id: row.id,
    name: row.name ?? '(名称未設定)',
    pref: row.pref ?? null,
    city: row.city ?? null,
    floorPattern: row.floor_coef_pattern ?? null,
  }
}

function mapEntryRow(row: StockEntryRaw): StockRegEntryOption {
  return {
    id: row.id,
    complexId: row.complex_id ?? null,
    floor: row.floor ?? null,
    area: row.area_sqm ?? null,
    layout: row.layout ?? null,
    maxPrice: row.max_price ?? null,
    coefTotal: row.coef_total ?? (safeNumber(row.interior_level_coef) + safeNumber(row.contract_year_coef)),
    interiorCoef: row.interior_level_coef ?? null,
    yearCoef: row.contract_year_coef ?? null,
    reins: row.reins_registered_date ?? null,
    contract: row.contract_date ?? null,
  }
}

export async function listStockComplexes(supabase: unknown): Promise<StockComplexOption[]> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await client
    .from('housing_complexes')
    .select('id, name, pref, city, floor_coef_pattern')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as StockComplexRow[]).map(mapComplexRow)
}

export async function listStocksByComplex(supabase: unknown, complexId: string): Promise<StockRow[]> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await client
    .from('estate_stocks')
    .select(`
      id, complex_id, estate_entry_id, floor, area_sqm, layout, registered_date, contract_date, list_price,
      target_unit_price, target_close_price, buy_target_price, raise_price,
      base_unit_price, coef_total, floor_coef, status, stock_mysoku_path,
      estate_entries ( renovated, contract_kind, estate_name )
    `)
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .order('registered_date', { ascending: false, nullsFirst: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as StockRow[]
}

export async function softDeleteStock(supabase: unknown, stockId: string, userId?: string | null) {
  const client = asStocksRepositoryClient(supabase)
  const { error } = await client.from('estate_stocks').update(buildStockDeletePayload(userId)).eq('id', stockId)
  if (error) throw error
}

export async function listMaxEntriesForComplex(supabase: unknown, complexId: string): Promise<StockRegEntryOption[]> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await client
    .from('estate_entries')
    .select('id, floor, area_sqm, layout, max_price, coef_total, interior_level_coef, contract_year_coef, reins_registered_date, contract_date, contract_kind')
    .eq('complex_id', complexId)
    .eq('contract_kind', 'MAX')
    .is('deleted_at', null)
    .order('contract_date', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) throw error
  return ((data ?? []) as StockEntryRaw[]).map(mapEntryRow)
}

export async function loadStockEntryContext(supabase: unknown, entryId: string): Promise<StockEntryContext | null> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await (client.from('estate_entries') as EstateEntriesMaybeSingleSelect)
    .select('id, complex_id, floor, area_sqm, layout, max_price, coef_total, interior_level_coef, contract_year_coef, reins_registered_date, contract_date, contract_kind')
    .eq('id', entryId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const raw = data as StockEntryRaw
  return {
    ...mapEntryRow(raw),
    complexId: raw.complex_id ?? null,
    contractKind: raw.contract_kind ?? null,
  }
}

export async function uploadStockPdf(supabase: unknown, file: File | null, userId: string, now: Date = new Date()): Promise<string | null> {
  if (!file) return null
  const client = asStocksRepositoryClient(supabase)
  if (!client.storage) throw new Error('storage client is not available')
  const sanitized = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const path = `${userId}/stock/${now.getTime()}-${sanitized}`
  const { error } = await client.storage.from('uploads').upload(path, file, { upsert: false, contentType: 'application/pdf' })
  if (error) throw new Error('PDFアップロード失敗: ' + error.message)
  return path
}

export async function insertStock(supabase: unknown, payload: Record<string, unknown>) {
  const client = asStocksRepositoryClient(supabase)
  const { error } = await client.from('estate_stocks').insert(payload)
  if (error) throw error
}

export async function loadStockDetail(supabase: unknown, stockId: string): Promise<StockDetailRow | null> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await (client.from('estate_stocks') as EstateStocksMaybeSingleSelect)
    .select('id, estate_entry_id, floor, area_sqm, list_price, registered_date, stock_mysoku_path, broker_name, broker_pref, broker_city, broker_town, broker_tel, broker_person, broker_mobile, broker_email, broker_mysoku_url, broker_photo_url, fundplan_url, status')
    .eq('id', stockId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as StockDetailRow | null
}

export async function loadStockEdit(supabase: unknown, stockId: string): Promise<StockEditRow | null> {
  const client = asStocksRepositoryClient(supabase)
  const { data, error } = await (client.from('estate_stocks') as EstateStocksMaybeSingleSelect)
    .select('id, complex_id, estate_entry_id, floor, area_sqm, layout, registered_date, contract_date, base_unit_price, coef_total, stock_mysoku_path')
    .eq('id', stockId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as StockEditRow | null
}

export async function createStockPdfSignedUrl(supabase: unknown, path: string): Promise<string> {
  const client = asStocksRepositoryClient(supabase)
  if (!client.storage) throw new Error('storage client is not available')
  const { data, error } = await client.storage.from('uploads').createSignedUrl(path, 600)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('PDF URLの生成に失敗しました')
  return data.signedUrl
}

export async function updateStock(supabase: unknown, stockId: string, payload: Record<string, unknown>) {
  const client = asStocksRepositoryClient(supabase)
  const { error } = await client.from('estate_stocks').update(payload).eq('id', stockId)
  if (error) throw error
}
