import { buildSoftDeletePayload } from '../deletePayload.ts'

type RepositoryError = { message: string }
type QueryInsertResult = Promise<{ error: RepositoryError | null }>
type QueryUpdateResult = Promise<{ error: RepositoryError | null }>

type EstateEntriesInsert = {
  insert(payload: Record<string, unknown> | Record<string, unknown>[]): QueryInsertResult
  update(payload: Record<string, unknown>): {
    eq(column: string, value: unknown): QueryUpdateResult
  }
}

type UploadsBucket = {
  upload(
    path: string,
    file: unknown,
    options: { upsert: boolean; contentType: string },
  ): Promise<{ error: RepositoryError | null }>
}

type EntriesRepositoryClient = {
  from(table: 'estate_entries'): EstateEntriesInsert
  storage?: {
    from(bucket: 'uploads'): UploadsBucket
  }
}

function asEntriesRepositoryClient(supabase: unknown): EntriesRepositoryClient {
  return supabase as EntriesRepositoryClient
}

export async function insertEntries(supabase: unknown, payloads: Record<string, unknown>[]) {
  const client = asEntriesRepositoryClient(supabase)
  const { error } = await client.from('estate_entries').insert(payloads)
  if (error) throw error
}

export async function updateEntry(supabase: unknown, entryId: string, payload: Record<string, unknown>) {
  const client = asEntriesRepositoryClient(supabase)
  const { error } = await client.from('estate_entries').update(payload).eq('id', entryId)
  if (error) throw error
}

export async function softDeleteEntry(supabase: unknown, entryId: string, userId?: string | null) {
  const client = asEntriesRepositoryClient(supabase)
  const { error } = await client.from('estate_entries').update(buildSoftDeletePayload(userId)).eq('id', entryId)
  if (error) throw error
}

export async function uploadEntryPdf(
  supabase: unknown,
  file: File | null,
  userId: string,
  suffix: string,
  label: string | null,
  now: Date = new Date(),
): Promise<string | null> {
  if (!file) return null
  const client = asEntriesRepositoryClient(supabase)
  if (!client.storage) throw new Error('storage client is not available')
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const path = `${userId}/mysoku/${now.getTime()}-${suffix}-${label || 'NONE'}-${safeName}`
  const { error } = await client.storage.from('uploads').upload(path, file, {
    upsert: false,
    contentType: 'application/pdf',
  })
  if (error) throw new Error('PDFアップロード失敗: ' + error.message)
  return path
}
