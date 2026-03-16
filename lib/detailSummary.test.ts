import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDetailSummary, formatJaDate, formatYenNumber, safeNumberOr } from './detailSummary.ts'

test('buildDetailSummary calculates target pricing and buy target from a detail row', () => {
  const summary = buildDetailSummary({
    estate_name: 'テスト団地',
    addr1: '大阪市',
    addr2: '北区',
    max_price: 32_000_000,
    area_sqm: 64,
    coef_total: 1.1,
    past_min: 21_000_000,
    interior_level_coef: 0.6,
    contract_year_coef: 0.5,
  })

  assert.deepEqual(summary, {
    name: 'テスト団地',
    addr: '大阪市 北区',
    area: 64,
    unit: 500000,
    targetClose: 35200000,
    raise: 29090000,
    pastMin: 21000000,
    interior: 0.6,
    yearCoef: 0.5,
    coefSum: 1.1,
    buyTarget: 16962700,
  })
})

test('format helpers in detailSummary keep fallback behavior stable', () => {
  assert.equal(safeNumberOr(undefined, 1), 1)
  assert.equal(formatJaDate('2026-03-16T00:00:00.000Z'), '2026/3/16')
  assert.equal(formatJaDate('invalid'), '-')
  assert.equal(formatYenNumber(1234567), '1,234,567')
})
