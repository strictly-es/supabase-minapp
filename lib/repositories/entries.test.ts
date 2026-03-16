import test from 'node:test'
import assert from 'node:assert/strict'

import { insertEntries, softDeleteEntry, updateEntry, uploadEntryPdf } from './entries.ts'

test('entry repository write helpers insert, update, delete, and upload pdf', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'estate_entries')
      return {
        insert: async (...args: unknown[]) => {
          calls.push({ method: 'insert', args })
          return { error: null }
        },
        update: (...args: unknown[]) => {
          calls.push({ method: 'update', args })
          return {
            eq: async (...eqArgs: unknown[]) => {
              calls.push({ method: 'eq', args: eqArgs })
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
          upload: async (path: string, file: unknown, options: unknown) => {
            assert.ok(file instanceof File)
            calls.push({ method: 'upload', args: [path, options] })
            return { error: null }
          },
        }
      },
    },
  }

  await insertEntries(supabase, [{ estate_name: '団地A' }])
  await updateEntry(supabase, 'entry-1', { estate_name: '団地B' })
  await softDeleteEntry(supabase, 'entry-1', 'user-1')
  const path = await uploadEntryPdf(
    supabase,
    new File(['pdf'], 'my file.pdf', { type: 'application/pdf' }),
    'user-1',
    'row-1',
    'MAX',
    new Date('2026-03-16T00:00:00.000Z'),
  )

  assert.equal(path, 'user-1/mysoku/1773619200000-row-1-MAX-my_file.pdf')
  assert.equal(calls.filter((call) => call.method === 'update').length, 2)
  assert.equal(calls.some((call) => call.method === 'upload'), true)
})
