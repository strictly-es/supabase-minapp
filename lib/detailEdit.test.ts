import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDetailEditPayload, formatInteriorLevelCoef, toHasElevator } from './detailEdit.ts'

test('buildDetailEditPayload normalizes optional fields and recomputes coef_total', () => {
  assert.deepEqual(
    buildDetailEditPayload({
      estate_name: ' テスト団地 ',
      management: '',
      pref: '大阪',
      addr1: '大阪市',
      addr2: '',
      floor: '3',
      elevator: '有',
      reins_registered_date: '2026-03-01',
      contract_date: '',
      max_price: '32000000',
      area_sqm: '64',
      coef_total: '0',
      interior_level_coef: '0.60',
      contract_year_coef: '0.50',
      past_min: '21000000',
    }, 'user/path.pdf'),
    {
      estate_name: 'テスト団地',
      management: null,
      pref: '大阪',
      addr1: '大阪市',
      addr2: null,
      floor: 3,
      has_elevator: true,
      reins_registered_date: '2026-03-01',
      contract_date: null,
      max_price: 32000000,
      area_sqm: 64,
      coef_total: 1.1,
      interior_level_coef: 0.6,
      contract_year_coef: 0.5,
      past_min: 21000000,
      mysoku_pdf_path: 'user/path.pdf',
    },
  )
})

test('detail edit helpers preserve elevator and coef formatting', () => {
  assert.equal(toHasElevator('有'), true)
  assert.equal(toHasElevator('無'), false)
  assert.equal(toHasElevator(''), null)
  assert.equal(formatInteriorLevelCoef(0.15), '1.15')
  assert.equal(formatInteriorLevelCoef(1.2), '1.20')
  assert.equal(formatInteriorLevelCoef(null), '')
})
