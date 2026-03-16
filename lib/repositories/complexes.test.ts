import test from 'node:test'
import assert from 'node:assert/strict'

import { insertComplex, insertComplexEvaluation, updateComplex } from './complexes.ts'

test('complex repository write helpers insert, update, and create evaluations', async () => {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      if (table === 'housing_complexes') {
        return {
          insert: (...args: unknown[]) => {
            calls.push({ table, method: 'insert', args })
            return {
              select: (...selectArgs: unknown[]) => {
                calls.push({ table, method: 'select', args: selectArgs })
                return {
                  single: async () => ({ data: { id: 'complex-1' }, error: null }),
                }
              },
            }
          },
          update: (...args: unknown[]) => {
            calls.push({ table, method: 'update', args })
            return {
              eq: async (...eqArgs: unknown[]) => {
                calls.push({ table, method: 'eq', args: eqArgs })
                return { error: null }
              },
            }
          },
        }
      }

      assert.equal(table, 'complex_evaluations')
      return {
        insert: async (...args: unknown[]) => {
          calls.push({ table, method: 'insert', args })
          return { error: null }
        },
      }
    },
  }

  assert.equal(await insertComplex(supabase, { name: '団地A' }), 'complex-1')
  await updateComplex(supabase, 'complex-1', { name: '団地B' })
  await insertComplexEvaluation(supabase, { complex_id: 'complex-1', total_score: 80 })

  assert.equal(calls.some((call) => call.table === 'housing_complexes' && call.method === 'update'), true)
  assert.equal(calls.some((call) => call.table === 'complex_evaluations' && call.method === 'insert'), true)
})
