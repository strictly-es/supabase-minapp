import {
  buildReferenceValueSummaries,
  type ConditionSummaryRow,
  type FloorSummaryRow,
  type ReferenceValueEntry,
} from '../referenceValue.ts'

type RepositoryError = { message: string }
type QueryMaybeSingleResult<T> = Promise<{ data: T | null; error: RepositoryError | null }>
type QueryListResult<T> = Promise<{ data: T[] | null; error: RepositoryError | null }>
type QueryCountResult = Promise<{ count: number | null; error: RepositoryError | null }>

type EstateEntriesCountSelect = {
  select(columns: string, options: { count: 'exact'; head: true }): {
    eq(column: string, value: unknown): {
      is(column: string, value: null): {
        gte(column: string, value: string): QueryCountResult
      }
    }
  }
}

type EstateEntriesReferenceSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      is(column: string, value: null): {
        limit(count: number): QueryListResult<Record<string, unknown>>
      }
    }
  }
}

type HousingComplexesSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      maybeSingle(): QueryMaybeSingleResult<Record<string, unknown>>
    }
  }
}

type ComplexEvaluationsSelect = {
  select(columns: string): {
    eq(column: string, value: unknown): {
      is(column: string, value: null): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): {
            maybeSingle(): QueryMaybeSingleResult<Record<string, unknown>>
          }
        }
      }
    }
  }
}

type ComplexEditRepositoryClient = {
  from(table: 'estate_entries'): EstateEntriesCountSelect & EstateEntriesReferenceSelect
  from(table: 'housing_complexes'): HousingComplexesSelect
  from(table: 'complex_evaluations'): ComplexEvaluationsSelect
}

type ComplexEditRow = {
  id: string
  name: string | null
  pref: string | null
  city: string | null
  town: string | null
  built_ym: string | null
  station_name: string | null
  station_access_type: string | null
  station_minutes: number | null
  unit_count: number | null
  building_structure: string | null
  floor_count: number | null
  seller: string | null
  builder: string | null
  mgmt_company: string | null
  mgmt_type: string | null
  mgmt_fee_monthly: number | null
  repair_reserve_fee_monthly: number | null
  other_fee_monthly: number | null
  rent_case_availability: string | null
  rent_case_max_monthly_rent: number | null
  map_url: string | null
  same_address_new_seismic_case: string | null
  same_address_old_seismic_case: string | null
  same_station_new_seismic_case: string | null
  same_station_old_seismic_case: string | null
}

type StoredOption = { value?: string; label?: string; score?: number }

type StoredFactors = {
  market?: { deals?: StoredOption; rentDemand?: StoredOption; inventory?: StoredOption }
  location?: { walk?: StoredOption; access?: StoredOption; convenience?: StoredOption }
  building?: { scale?: StoredOption; elevator?: StoredOption; mgmt?: StoredOption; appearance?: StoredOption; parking?: StoredOption; view?: StoredOption }
  plus?: { future?: StoredOption; focus?: StoredOption; support?: StoredOption }
}

type ComplexEvaluationRow = {
  id: string
  factors: StoredFactors | null
  note: string | null
}

export type ComplexEditSnapshot = {
  complex: ComplexEditRow | null
  evaluation: ComplexEvaluationRow | null
}

export type ComplexReferenceSummaries = {
  rows: ReferenceValueEntry[]
  conditionSummaries: ConditionSummaryRow[]
  floorSummaries: FloorSummaryRow[]
}

function asComplexEditRepositoryClient(supabase: unknown): ComplexEditRepositoryClient {
  return supabase as ComplexEditRepositoryClient
}

export async function countComplexContractsSince(supabase: unknown, complexId: string, sinceText: string): Promise<number> {
  const client = asComplexEditRepositoryClient(supabase)
  const { count, error } = await client
    .from('estate_entries')
    .select('id', { count: 'exact', head: true })
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .gte('contract_date', sinceText)
  if (error) throw error
  return count ?? 0
}

export async function loadComplexReferenceSummaries(supabase: unknown, complexId: string): Promise<ComplexReferenceSummaries> {
  const client = asComplexEditRepositoryClient(supabase)
  const { data, error } = await client
    .from('estate_entries')
    .select('condition_status, floor, unit_price, contract_price, area_sqm, contract_date')
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .limit(5000)
  if (error) throw error
  const rows = (data ?? []) as ReferenceValueEntry[]
  return {
    rows,
    ...buildReferenceValueSummaries(rows),
  }
}

export async function loadComplexEditSnapshot(supabase: unknown, complexId: string): Promise<ComplexEditSnapshot> {
  const client = asComplexEditRepositoryClient(supabase)
  const { data: complex, error: complexError } = await client
    .from('housing_complexes')
    .select(`
      id, name, pref, city, town, built_ym,
      station_name, station_access_type, station_minutes,
      unit_count, building_structure, floor_count,
      seller, builder, mgmt_company, mgmt_type,
      mgmt_fee_monthly, repair_reserve_fee_monthly, other_fee_monthly,
      rent_case_availability, rent_case_max_monthly_rent,
      map_url,
      same_address_new_seismic_case, same_address_old_seismic_case,
      same_station_new_seismic_case, same_station_old_seismic_case
    `)
    .eq('id', complexId)
    .maybeSingle()
  if (complexError) throw complexError

  const { data: evaluation, error: evaluationError } = await client
    .from('complex_evaluations')
    .select('id, factors, note')
    .eq('complex_id', complexId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (evaluationError) throw evaluationError

  return {
    complex: (complex ?? null) as ComplexEditRow | null,
    evaluation: (evaluation ?? null) as ComplexEvaluationRow | null,
  }
}
