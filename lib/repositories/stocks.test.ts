import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createStockPdfSignedUrl,
  insertStock,
  loadStockEntryContext,
  listMaxEntriesForComplex,
  listStockComplexes,
  listStocksByComplex,
  loadStockDetail,
  loadStockEdit,
  softDeleteStock,
  updateStock,
  uploadStockPdf,
} from './stocks.ts'

test('listStockComplexes maps complex rows for stock screens', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'housing_complexes')
      return {
        select: (...args: unknown[]) => {
          calls.push({ method: 'select', args })
          return {
            is: (...isArgs: unknown[]) => {
              calls.push({ method: 'is', args: isArgs })
              return {
                order: async (...orderArgs: unknown[]) => {
                  calls.push({ method: 'order', args: orderArgs })
                  return {
                    data: [{ id: 'c1', name: null, pref: '大阪府', city: '大阪市', floor_coef_pattern: '②中間' }],
                    error: null,
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.deepEqual(await listStockComplexes(supabase), [{
    id: 'c1',
    name: '(名称未設定)',
    pref: '大阪府',
    city: '大阪市',
    floorPattern: '②中間',
  }])
  assert.equal(calls.some((call) => call.method === 'is' && call.args[0] === 'deleted_at'), true)
})

test('stock repository read helpers keep list and MAX-entry query shapes stable', async () => {
  let tableCall = 0
  const supabase = {
    from: (table: string) => {
      tableCall += 1
      if (tableCall === 1) {
        assert.equal(table, 'estate_stocks')
        return {
          select: () => ({
            eq: (...eqArgs: unknown[]) => {
              assert.deepEqual(eqArgs, ['complex_id', 'complex-1'])
              return {
                is: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: [{ id: 's1', floor: 3, area_sqm: 60, list_price: 20000000 }],
                      error: null,
                    }),
                  }),
                }),
              }
            },
          }),
        }
      }

      assert.equal(table, 'estate_entries')
      return {
        select: () => ({
          eq: (...eqArgs: unknown[]) => {
            assert.deepEqual(eqArgs, ['complex_id', 'complex-1'])
            return {
              eq: (...kindArgs: unknown[]) => {
                assert.deepEqual(kindArgs, ['contract_kind', 'MAX'])
                return {
                  is: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [{
                          id: 'e1',
                          floor: 5,
                          area_sqm: 72.5,
                          layout: '3LDK',
                          max_price: 31000000,
                          coef_total: null,
                          interior_level_coef: 0.2,
                          contract_year_coef: 0.15,
                          reins_registered_date: '2026-03-01',
                          contract_date: '2026-03-10',
                        }],
                        error: null,
                      }),
                    }),
                  }),
                }
              },
            }
          },
        }),
      }
    },
  }

  assert.deepEqual(await listStocksByComplex(supabase, 'complex-1'), [{ id: 's1', floor: 3, area_sqm: 60, list_price: 20000000 }])
  assert.deepEqual(await listMaxEntriesForComplex(supabase, 'complex-1'), [{
    id: 'e1',
    complexId: null,
    floor: 5,
    area: 72.5,
    layout: '3LDK',
    maxPrice: 31000000,
    coefTotal: 0.35,
    interiorCoef: 0.2,
    yearCoef: 0.15,
    reins: '2026-03-01',
    contract: '2026-03-10',
  }])
})

test('loadStockEntryContext returns entry context for stock registration routing', async () => {
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'estate_entries')
      return {
        select: () => ({
          eq: (...eqArgs: unknown[]) => {
            assert.deepEqual(eqArgs, ['id', 'entry-1'])
            return {
              maybeSingle: async () => ({
                data: {
                  id: 'entry-1',
                  complex_id: 'complex-1',
                  floor: 4,
                  area_sqm: 68.2,
                  layout: '3LDK',
                  max_price: 29800000,
                  coef_total: 1.15,
                  interior_level_coef: 1.05,
                  contract_year_coef: 0.1,
                  reins_registered_date: '2026-03-01',
                  contract_date: '2026-03-10',
                  contract_kind: 'MAX',
                },
                error: null,
              }),
            }
          },
        }),
      }
    },
  }

  assert.deepEqual(await loadStockEntryContext(supabase, 'entry-1'), {
    id: 'entry-1',
    complexId: 'complex-1',
    floor: 4,
    area: 68.2,
    layout: '3LDK',
    maxPrice: 29800000,
    coefTotal: 1.15,
    interiorCoef: 1.05,
    yearCoef: 0.1,
    reins: '2026-03-01',
    contract: '2026-03-10',
    contractKind: 'MAX',
  })
})

test('stock repository write helpers upload, insert, and soft delete', async () => {
  const updateCalls: Array<{ method: string; args: unknown[] }> = []
  const supabaseForWrite = {
    from: (table: string) => {
      assert.equal(table, 'estate_stocks')
      return {
        insert: async (...args: unknown[]) => {
          updateCalls.push({ method: 'insert', args })
          return { error: null }
        },
        update: (...args: unknown[]) => {
          updateCalls.push({ method: 'update', args })
          return {
            eq: async (...eqArgs: unknown[]) => {
              updateCalls.push({ method: 'eq', args: eqArgs })
              return { error: null }
            },
          }
        },
      }
    },
  }
  await insertStock(supabaseForWrite, { complex_id: 'complex-1' })
  await softDeleteStock(supabaseForWrite, 'stock-1', 'user-1')
  assert.equal(updateCalls.filter((call) => call.method === 'insert').length, 1)
  assert.equal(updateCalls.filter((call) => call.method === 'update').length, 1)

  const uploads: Array<{ path: string; options: unknown }> = []
  const supabaseForUpload = {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'uploads')
        return {
          upload: async (path: string, file: unknown, options: unknown) => {
            assert.ok(file instanceof File)
            uploads.push({ path, options })
            return { error: null }
          },
        }
      },
    },
  }
  const file = new File(['pdf'], 'my file.pdf', { type: 'application/pdf' })
  assert.equal(await uploadStockPdf(supabaseForUpload, file, 'user-1', new Date('2026-03-16T00:00:00.000Z')), 'user-1/stock/1773619200000-my_file.pdf')
  assert.deepEqual(uploads, [{
    path: 'user-1/stock/1773619200000-my_file.pdf',
    options: { upsert: false, contentType: 'application/pdf' },
  }])
})

test('stock repository detail/edit helpers load rows, create signed urls, and update records', async () => {
  let callIndex = 0
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'estate_stocks')
      callIndex += 1
      if (callIndex === 1) {
        return {
          select: () => ({
            eq: (...eqArgs: unknown[]) => {
              assert.deepEqual(eqArgs, ['id', 'stock-1'])
              return {
                maybeSingle: async () => ({
                  data: { id: 'stock-1', estate_entry_id: 'entry-1', stock_mysoku_path: 'stocks/a.pdf' },
                  error: null,
                }),
              }
            },
          }),
        }
      }
      if (callIndex === 2) {
        return {
          select: () => ({
            eq: (...eqArgs: unknown[]) => {
              assert.deepEqual(eqArgs, ['id', 'stock-1'])
              return {
                maybeSingle: async () => ({
                  data: { id: 'stock-1', complex_id: 'complex-1', area_sqm: 55.2, coef_total: 1.1 },
                  error: null,
                }),
              }
            },
          }),
        }
      }
      return {
        update: (...args: unknown[]) => {
          assert.deepEqual(args, [{ status: '買付' }])
          return {
            eq: async (...eqArgs: unknown[]) => {
              assert.deepEqual(eqArgs, ['id', 'stock-1'])
              return { error: null }
            },
          }
        },
      }
    },
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'uploads')
        return {
          createSignedUrl: async (path: string, expiresIn: number) => {
            assert.equal(path, 'stocks/a.pdf')
            assert.equal(expiresIn, 600)
            return { data: { signedUrl: 'https://example.com/stocks/a.pdf' }, error: null }
          },
        }
      },
    },
  }

  assert.deepEqual(await loadStockDetail(supabase, 'stock-1'), {
    id: 'stock-1',
    estate_entry_id: 'entry-1',
    stock_mysoku_path: 'stocks/a.pdf',
  })
  assert.deepEqual(await loadStockEdit(supabase, 'stock-1'), {
    id: 'stock-1',
    complex_id: 'complex-1',
    area_sqm: 55.2,
    coef_total: 1.1,
  })
  assert.equal(await createStockPdfSignedUrl(supabase, 'stocks/a.pdf'), 'https://example.com/stocks/a.pdf')
  await updateStock(supabase, 'stock-1', { status: '買付' })
})
