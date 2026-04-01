import test from 'node:test'
import assert from 'node:assert/strict'

import {
  countComplexContractsSince,
  loadComplexEditSnapshot,
  loadComplexReferenceSummaries,
} from './complexEdit.ts'

test('countComplexContractsSince scopes the count query by complex, deleted flag, and date', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'estate_entries')
      return {
        select: (...args: unknown[]) => {
          calls.push({ method: 'select', args })
          return {
            eq: (...eqArgs: unknown[]) => {
              calls.push({ method: 'eq', args: eqArgs })
              return {
                is: (...isArgs: unknown[]) => {
                  calls.push({ method: 'is', args: isArgs })
                  return {
                    gte: async (...gteArgs: unknown[]) => {
                      calls.push({ method: 'gte', args: gteArgs })
                      return { count: 7, error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.equal(await countComplexContractsSince(supabase, 'complex-1', '2023-01-01T00:00:00.000Z'), 7)
  assert.deepEqual(calls, [
    { method: 'select', args: ['id', { count: 'exact', head: true }] },
    { method: 'eq', args: ['complex_id', 'complex-1'] },
    { method: 'is', args: ['deleted_at', null] },
    { method: 'gte', args: ['contract_date', '2023-01-01T00:00:00.000Z'] },
  ])
})

test('loadComplexReferenceSummaries builds condition and floor summaries from entry rows', async () => {
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'estate_entries')
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              limit: async () => ({
                data: [
                  { condition_status: 'FULL_RENO_INSULATED', floor: 4, unit_price: 550000, contract_price: null, area_sqm: null, contract_date: '2024-04-01' },
                  { condition_status: 'FULL_RENO_INSULATED', floor: 2, unit_price: 450000, contract_price: null, area_sqm: null, contract_date: '2023-04-01' },
                  { condition_status: 'OWNER_OCCUPIED', floor: 1, unit_price: null, contract_price: 18000000, area_sqm: 45, contract_date: '2022-04-01' },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }
    },
  }

  const { conditionSummaries, floorSummaries } = await loadComplexReferenceSummaries(supabase, 'complex-1')
  assert.deepEqual(conditionSummaries.find((row) => row.key === 'FULL_RENO_INSULATED'), {
    key: 'FULL_RENO_INSULATED',
    label: 'フルリノベーション+断熱',
    max: 550000,
    mean: 500000,
  })
  assert.deepEqual(conditionSummaries.find((row) => row.key === 'OWNER_OCCUPIED'), {
    key: 'OWNER_OCCUPIED',
    label: '売主居住中（または居住可能な状態）',
    max: 400000,
    mean: 400000,
  })
  assert.deepEqual(floorSummaries.slice(0, 3), [
    { floor: 4, max: 550000, mean: 550000, coef: 2.75 },
    { floor: 2, max: 450000, mean: 450000, coef: 2.25 },
    { floor: 1, max: 400000, mean: 400000, coef: 1 },
  ])
})

test('loadComplexEditSnapshot returns the latest complex and evaluation rows', async () => {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      if (table === 'housing_complexes') {
        return {
          select: (...args: unknown[]) => {
            calls.push({ table, method: 'select', args })
            return {
              eq: (...eqArgs: unknown[]) => {
                calls.push({ table, method: 'eq', args: eqArgs })
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'complex-1',
                      name: '団地A',
                      unit_count: 120,
                      station_minutes: 8,
                      mgmt_fee_monthly: 12000,
                      repair_reserve_fee_monthly: 8000,
                      other_fee_monthly: 1500,
                      rent_case_availability: '有',
                      rent_case_max_monthly_rent: 95000,
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      assert.equal(table, 'complex_evaluations')
      return {
        select: (...args: unknown[]) => {
          calls.push({ table, method: 'select', args })
          return {
            eq: (...eqArgs: unknown[]) => {
              calls.push({ table, method: 'eq', args: eqArgs })
              return {
                is: (...isArgs: unknown[]) => {
                  calls.push({ table, method: 'is', args: isArgs })
                  return {
                    order: (...orderArgs: unknown[]) => {
                      calls.push({ table, method: 'order', args: orderArgs })
                      return {
                        limit: (...limitArgs: unknown[]) => {
                          calls.push({ table, method: 'limit', args: limitArgs })
                          return {
                            maybeSingle: async () => ({
                              data: { id: 'eval-1', factors: { market: { deals: { value: 'rich' } } }, note: '最新' },
                              error: null,
                            }),
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.deepEqual(await loadComplexEditSnapshot(supabase, 'complex-1'), {
    complex: {
      id: 'complex-1',
      name: '団地A',
      unit_count: 120,
      station_minutes: 8,
      mgmt_fee_monthly: 12000,
      repair_reserve_fee_monthly: 8000,
      other_fee_monthly: 1500,
      rent_case_availability: '有',
      rent_case_max_monthly_rent: 95000,
    },
    evaluation: { id: 'eval-1', factors: { market: { deals: { value: 'rich' } } }, note: '最新' },
  })
  assert.equal(calls.some((call) => call.table === 'complex_evaluations' && call.method === 'order'), true)
})
