type RepositoryError = { message: string }
type QueryInsertSingleResult<T> = Promise<{ data: T | null; error: RepositoryError | null }>
type QueryInsertResult = Promise<{ error: RepositoryError | null }>
type QueryUpdateResult = Promise<{ error: RepositoryError | null }>

type HousingComplexesInsert = {
  insert(payload: Record<string, unknown>): {
    select(columns: string): {
      single(): QueryInsertSingleResult<{ id: string }>
    }
  }
  update(payload: Record<string, unknown>): {
    eq(column: string, value: unknown): QueryUpdateResult
  }
}

type ComplexEvaluationsInsert = {
  insert(payload: Record<string, unknown>): QueryInsertResult
}

type ComplexesRepositoryClient = {
  from(table: 'housing_complexes'): HousingComplexesInsert
  from(table: 'complex_evaluations'): ComplexEvaluationsInsert
}

function asComplexesRepositoryClient(supabase: unknown): ComplexesRepositoryClient {
  return supabase as ComplexesRepositoryClient
}

export async function insertComplex(supabase: unknown, payload: Record<string, unknown>): Promise<string> {
  const client = asComplexesRepositoryClient(supabase)
  const { data, error } = await client.from('housing_complexes').insert(payload).select('id').single()
  if (error) throw error
  if (!data?.id) throw new Error('団地IDの取得に失敗しました')
  return data.id
}

export async function updateComplex(supabase: unknown, complexId: string, payload: Record<string, unknown>) {
  const client = asComplexesRepositoryClient(supabase)
  const { error } = await client.from('housing_complexes').update(payload).eq('id', complexId)
  if (error) throw error
}

export async function insertComplexEvaluation(supabase: unknown, payload: Record<string, unknown>) {
  const client = asComplexesRepositoryClient(supabase)
  const { error } = await client.from('complex_evaluations').insert(payload)
  if (error) throw error
}
