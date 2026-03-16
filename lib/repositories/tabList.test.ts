import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createEntryPdfSignedUrl,
  hasEntryKindConflict,
  listTabListComplexes,
  listTabListEntries,
  softDeleteTabListEntry,
  updateTabListEntry,
} from './tabList.ts'

type MockResponse = { data?: unknown[] | null; error?: { message: string } | null }

function createQueryMock(response: MockResponse, calls: Array<{ method: string; args: unknown[] }>) {
  return {
    select(...args: unknown[]) {
      calls.push({ method: 'select', args })
      return this
    },
    is(...args: unknown[]) {
      calls.push({ method: 'is', args })
      return this
    },
    order(...args: unknown[]) {
      calls.push({ method: 'order', args })
      return {
        limit: (...limitArgs: unknown[]) => {
          calls.push({ method: 'limit', args: limitArgs })
          return Promise.resolve(response)
        },
        then: (onFulfilled: (value: MockResponse) => unknown) => Promise.resolve(response).then(onFulfilled),
      }
    },
    eq(...args: unknown[]) {
      calls.push({ method: 'eq', args })
      return this
    },
    neq(...args: unknown[]) {
      calls.push({ method: 'neq', args })
      return this
    },
    update(...args: unknown[]) {
      calls.push({ method: 'update', args })
      return {
        eq: (...eqArgs: unknown[]) => {
          calls.push({ method: 'eq', args: eqArgs })
          return Promise.resolve(response)
        },
      }
    },
  }
}

test('listTabListComplexes maps raw Supabase rows to UI options', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'housing_complexes')
      return createQueryMock({
        data: [{ id: 'c1', name: null, pref: '大阪府', city: '大阪市', town: '北区', station_name: '梅田', station_access_type: '徒歩', station_minutes: 8, unit_count: 120 }],
        error: null,
      }, calls)
    },
  }

  assert.deepEqual(await listTabListComplexes(supabase), [{
    id: 'c1',
    name: '(名称未設定)',
    pref: '大阪府',
    city: '大阪市',
    town: '北区',
    stationName: '梅田',
    stationAccessType: '徒歩',
    stationMinutes: 8,
    unitCount: 120,
  }])
  assert.equal(calls.some((call) => call.method === 'is' && call.args[0] === 'deleted_at'), true)
})

test('listTabListEntries falls back to legacy select when newer columns are missing', async () => {
  let count = 0
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              limit: async () => {
                count += 1
                if (count === 1) return { data: null, error: { message: 'column built_month does not exist' } }
                return {
                  data: [{ id: 'e1', contract_kind: 'MAX', floor: 3, area_sqm: 64, has_elevator: true, reins_registered_date: null, contract_date: null, max_price: 32000000, past_min: null, mysoku_pdf_path: null, created_at: '2026-03-16T00:00:00.000Z' }],
                  error: null,
                }
              },
            }),
          }),
        }),
      }),
    }),
  }

  assert.deepEqual(await listTabListEntries(supabase, 'complex-1'), [{
    id: 'e1',
    contract_kind: 'MAX',
    floor: 3,
    area_sqm: 64,
    has_elevator: true,
    reins_registered_date: null,
    contract_date: null,
    max_price: 32000000,
    past_min: null,
    mysoku_pdf_path: null,
    created_at: '2026-03-16T00:00:00.000Z',
    contract_price: null,
    unit_price: null,
    built_month: null,
    building_no: null,
    condition_status: null,
  }])
})

test('tab-list repository write helpers update, delete, conflict-check, and signed url', async () => {
  const updateCalls: Array<{ method: string; args: unknown[] }> = []
  const supabaseForUpdate = {
    from: () => createQueryMock({ error: null }, updateCalls),
  }
  await updateTabListEntry(supabaseForUpdate, 'entry-1', { contract_kind: 'MAX' })
  await softDeleteTabListEntry(supabaseForUpdate, 'entry-1', 'user-1')
  assert.equal(updateCalls.filter((call) => call.method === 'update').length, 2)

  const supabaseForConflict = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            neq: () => ({
              is: () => ({
                limit: async () => ({ data: [{ id: 'other' }], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  }
  assert.equal(await hasEntryKindConflict(supabaseForConflict, 'complex-1', 'MAX', 'entry-1'), true)

  const supabaseForSignedUrl = {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'uploads')
        return {
          createSignedUrl: async (path: string, expiresIn: number) => {
            assert.equal(path, 'file.pdf')
            assert.equal(expiresIn, 600)
            return { data: { signedUrl: 'https://example.com/file.pdf' }, error: null }
          },
        }
      },
    },
  }
  assert.equal(await createEntryPdfSignedUrl(supabaseForSignedUrl, 'file.pdf'), 'https://example.com/file.pdf')
})
