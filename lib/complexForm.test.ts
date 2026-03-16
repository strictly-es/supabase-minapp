import test from 'node:test'
import assert from 'node:assert/strict'

import { calcBuiltAge, formatComplexUnitPrice } from './complexForm.ts'

test('calcBuiltAge uses month-aware year difference', () => {
  assert.equal(calcBuiltAge('2000-05', new Date('2026-03-16T00:00:00.000Z')), 25)
  assert.equal(calcBuiltAge('2000-03', new Date('2026-03-16T00:00:00.000Z')), 26)
  assert.equal(calcBuiltAge('', new Date('2026-03-16T00:00:00.000Z')), null)
})

test('formatComplexUnitPrice reuses common unit formatting', () => {
  assert.equal(formatComplexUnitPrice(1234.5), '1,234.50円/㎡')
  assert.equal(formatComplexUnitPrice(null), '—')
})
