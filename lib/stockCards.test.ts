import test from 'node:test'
import assert from 'node:assert/strict'

import { buildStockDeletePayload, diffFromNowDays, formatStockYen, mapStockRowToCard } from './stockCards.ts'

test('mapStockRowToCard derives fallback target values and elapsed days', () => {
  const card = mapStockRowToCard(
    {
      id: 'stock-1',
      floor: 4,
      area_sqm: 64,
      layout: ' 3LDK ',
      registered_date: '2026-03-01',
      contract_date: null,
      list_price: 28_000_000,
      target_unit_price: null,
      target_close_price: null,
      buy_target_price: null,
      raise_price: null,
      base_unit_price: 500_000,
      coef_total: 1.1,
      floor_coef: 0.99,
      status: null,
      estate_entries: { renovated: true, contract_kind: 'MAX', estate_name: 'テスト' },
    },
    new Date('2026-03-16T00:00:00.000Z'),
  )

  assert.deepEqual(card, {
    id: 'stock-1',
    floor: 4,
    area: 64,
    layout: '3LDK',
    reg: '2026-03-01',
    contract: '',
    price: 28000000,
    unit: 437500,
    targetUnit: 544500,
    targetPrice: 34848000,
    buyTarget: 16710400,
    raise: 28800000,
    status: '未設定',
    days: 15,
    renovated: true,
  })
})

test('stock card helpers keep delete payload and formatting stable', () => {
  assert.equal(diffFromNowDays('2026-03-10', new Date('2026-03-16T00:00:00.000Z')), 6)
  assert.equal(formatStockYen(1234567), '1,234,567 円')
  assert.deepEqual(buildStockDeletePayload('user-1', new Date('2026-03-16T10:00:00.000Z')), {
    deleted_at: '2026-03-16T10:00:00.000Z',
    deleted_by: 'user-1',
  })
})
