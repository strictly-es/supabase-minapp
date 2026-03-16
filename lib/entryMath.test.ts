import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calcElapsedDays,
  calcUnitPrice,
  calcUnitPriceFromStrings,
  diffDays,
  effectivePrice,
  effectiveUnitPrice,
  elevatorChoiceToDb,
  formatUnitPrice,
  monthToDateOrNull,
  toDateInputValue,
  toFloatOrNull,
  toIntOrNull,
  toMonthInputValue,
} from './entryMath.ts'

test('toIntOrNull and toFloatOrNull parse numeric strings and reject blanks', () => {
  assert.equal(toIntOrNull('42'), 42)
  assert.equal(toIntOrNull(''), null)
  assert.equal(toFloatOrNull('10.5'), 10.5)
  assert.equal(toFloatOrNull('   '), null)
})

test('date input helpers normalize timestamp strings', () => {
  assert.equal(toDateInputValue('2026-03-15T09:30:00+09:00'), '2026-03-15')
  assert.equal(toMonthInputValue('2026-03-15T09:30:00+09:00'), '2026-03')
  assert.equal(monthToDateOrNull('2026-03'), '2026-03-01')
})

test('calcUnitPrice and calcUnitPriceFromStrings return rounded unit prices', () => {
  assert.equal(calcUnitPrice(12345678, 78.91), 156452.64)
  assert.equal(calcUnitPriceFromStrings('12345678', '78.91'), 156452.64)
  assert.equal(calcUnitPriceFromStrings('12345678', '0'), null)
})

test('diffDays and calcElapsedDays compute whole day differences', () => {
  assert.equal(diffDays('2026-03-01', '2026-03-16'), 15)
  assert.equal(calcElapsedDays('2026-03-01', '2026-03-16'), 15)
  assert.equal(calcElapsedDays('', '2026-03-16'), null)
})

test('effectivePrice and effectiveUnitPrice use fallback columns when needed', () => {
  assert.equal(effectivePrice({ contract_price: null, max_price: 3200, past_min: 2800 }), 3200)
  assert.equal(
    effectiveUnitPrice({ unit_price: null, contract_price: null, max_price: 32_000_000, past_min: null, area_sqm: 64 }),
    500000,
  )
  assert.equal(effectiveUnitPrice({ unit_price: 410000, contract_price: 32_000_000, area_sqm: 64 }), 410000)
})

test('elevatorChoiceToDb and formatUnitPrice keep UI mapping stable', () => {
  assert.equal(elevatorChoiceToDb('あり'), true)
  assert.equal(elevatorChoiceToDb('なし'), false)
  assert.equal(elevatorChoiceToDb('スキップ'), null)
  assert.equal(formatUnitPrice(1234.5), '1,234.50円/㎡')
  assert.equal(formatUnitPrice(null), '—')
})
