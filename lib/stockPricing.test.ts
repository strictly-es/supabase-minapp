import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFloorRows,
  calcBaseUnitPrice,
  calcBrokerage,
  calcMoveCost,
  calcOtherCost,
  formatUnit,
  getFloorCoefs,
  safeNumber,
  toFixedString,
  toNumberString,
} from './stockPricing.ts'

test('safeNumber parses strings and defaults invalid values to zero', () => {
  assert.equal(safeNumber('10.5'), 10.5)
  assert.equal(safeNumber(''), 0)
  assert.equal(safeNumber(null), 0)
})

test('getFloorCoefs returns configured pattern coefficients with safe fallback', () => {
  assert.deepEqual(getFloorCoefs('①保守的'), [1.0, 0.98, 0.95, 0.9, 0.85])
  assert.deepEqual(getFloorCoefs('unknown'), [1, 1, 1, 1, 1])
})

test('cost helpers keep pricing thresholds stable', () => {
  assert.equal(calcMoveCost(55), 7260000)
  assert.equal(calcMoveCost(70), 8960000)
  assert.equal(calcMoveCost(85), 10455000)
  assert.equal(calcBrokerage(9_900_000), 550000)
  assert.equal(calcBrokerage(10_000_000), 550000)
  assert.equal(calcOtherCost(10_000_000), 750000)
})

test('buildFloorRows calculates target prices and buy target per floor pattern', () => {
  const rows = buildFloorRows(500000, 1.1, 60, '②中間')
  assert.equal(rows.length, 5)
  assert.deepEqual(rows[0], {
    floor: 1,
    floorCoef: 1,
    targetUnit: 550000,
    targetClose: 33000000,
    raise: 27270000,
    buyTarget: 15804900,
  })
  assert.equal(rows[4]?.targetUnit, 484000)
})

test('display helpers preserve existing form defaults', () => {
  assert.equal(calcBaseUnitPrice(32_000_000, 64), '500000')
  assert.equal(calcBaseUnitPrice(null, 64), '')
  assert.equal(toNumberString(12.3), '12.3')
  assert.equal(toFixedString(1.234, '1.00'), '1.23')
  assert.equal(formatUnit(500000), '500,000 円/㎡')
})
