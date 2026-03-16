import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatAddr,
  formatBuilt,
  formatStation,
  formatYenOrDash,
  mapComplexesToCards,
  normalizePref,
} from './complexCards.ts'

test('format helpers for complex cards preserve displayed strings', () => {
  assert.equal(formatAddr('大阪府', '大阪市', '北区'), '大阪府 大阪市 北区')
  assert.equal(formatStation('梅田', '徒歩', 8), '最寄: 梅田 (徒歩8分)')
  assert.equal(formatBuilt('1999-04', 26), '1999/04 (築26年)')
  assert.equal(normalizePref('大阪府'), '大阪')
  assert.equal(formatYenOrDash(1200000), '1,200,000円')
  assert.equal(formatYenOrDash(null), '—')
})

test('mapComplexesToCards combines complex, entry, stock, and evaluation summaries', () => {
  const cards = mapComplexesToCards(
    [
      {
        id: 'complex-1',
        name: 'テスト団地',
        pref: '大阪府',
        city: '大阪市',
        town: '北区',
        built_ym: '1999-04',
        built_age: 26,
        station_name: '梅田',
        station_access_type: '徒歩',
        station_minutes: 8,
        unit_count: 120,
        has_elevator: true,
        floor_coef_pattern: '②中間',
        complex_evaluations: [
          {
            id: 'eval-1',
            total_score: 78,
            created_at: '2026-03-10T00:00:00.000Z',
            factors: {
              market: { deals: { score: 10 }, rentDemand: { score: 5 }, inventory: { score: 3 } },
              location: { walk: { score: 8 }, access: { score: 3 }, convenience: { score: 6 } },
              building: { scale: { score: 5 }, elevator: { score: 5 }, mgmt: { score: 10 }, appearance: { score: 5 }, parking: { score: 2 }, view: { score: 6 } },
              plus: { future: { score: 3 }, focus: { score: 3 }, support: { score: 5 } },
            },
          },
        ],
      },
    ],
    [
      { complex_id: 'complex-1', contract_kind: 'MAX', max_price: 32_000_000, past_min: null, area_sqm: 64, reins_registered_date: '2026-01-01', contract_date: '2026-01-20' },
      { complex_id: 'complex-1', contract_kind: 'MINI', max_price: null, past_min: 21_000_000, area_sqm: 64, reins_registered_date: '2026-02-01', contract_date: '2026-02-18' },
    ],
    [
      { complex_id: 'complex-1', registered_date: '2026-03-01' },
      { complex_id: 'complex-1', registered_date: '2026-03-05' },
    ],
    new Date('2026-03-16T00:00:00.000Z'),
  )

  assert.deepEqual(cards, [
    {
      id: 'complex-1',
      name: 'テスト団地',
      pref: '大阪府',
      addr: '大阪府 大阪市 北区',
      station: '最寄: 梅田 (徒歩8分)',
      built: '1999/04 (築26年)',
      builtAge: 26,
      units: '120戸',
      score: 78,
      hasElevator: true,
      floorPattern: '②中間',
      area: 64,
      market: 18,
      loc: 17,
      bld: 33,
      plus: 11,
      maxPrice: 32000000,
      maxUnitPrice: 500000,
      miniPrice: 21000000,
      miniUnitPrice: 328125,
      miniElapsedDays: 17,
      stockCount: 2,
      stockDaysOldest: 15,
      stockAlertDays: 12,
      showStockTimingAlert: true,
    },
  ])
})
