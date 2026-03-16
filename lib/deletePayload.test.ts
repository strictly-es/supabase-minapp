import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSoftDeletePayload } from './deletePayload.ts'

test('buildSoftDeletePayload includes deleted_by only when a user id exists', () => {
  const now = new Date('2026-03-16T10:00:00.000Z')
  assert.deepEqual(buildSoftDeletePayload('user-1', now), {
    deleted_at: '2026-03-16T10:00:00.000Z',
    deleted_by: 'user-1',
  })
  assert.deepEqual(buildSoftDeletePayload(null, now), {
    deleted_at: '2026-03-16T10:00:00.000Z',
  })
})
