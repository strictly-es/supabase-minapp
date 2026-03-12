import test from 'node:test'
import assert from 'node:assert/strict'

import { buildReferenceValueSummaries, resolveReferenceUnitPrice, type ReferenceValueEntry } from './referenceValue.ts'

const baseRows: ReferenceValueEntry[] = [
  { floor: 1, area_sqm: 50, contract_price: 10000000, unit_price: 200000, condition_status: 'FULL_RENO_INSULATED' },
  { floor: 1, area_sqm: 40, contract_price: 8800000, unit_price: 220000, condition_status: 'FULL_RENO_INSULATED' },
  { floor: 2, area_sqm: 50, contract_price: 9000000, unit_price: 180000, condition_status: 'FULL_RENO_HIGH_DESIGN' },
  { floor: 2, area_sqm: 40, contract_price: 6400000, unit_price: 160000, condition_status: 'PARTIAL_REFORM' },
  { floor: 3, area_sqm: 50, contract_price: 7500000, unit_price: 150000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
  { floor: 3, area_sqm: 40, contract_price: 5200000, unit_price: 130000, condition_status: 'NEEDS_RENOVATION' },
  { floor: 4, area_sqm: 50, contract_price: 7000000, unit_price: 140000, condition_status: 'OWNER_OCCUPIED' },
  { floor: 5, area_sqm: 50, contract_price: 5500000, unit_price: 110000, condition_status: null },
]

test('buildReferenceValueSummaries matches documented reference table expectations', () => {
  const { conditionSummaries, floorSummaries } = buildReferenceValueSummaries(baseRows)

  assert.deepEqual(conditionSummaries, [
    { key: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱', max: 220000, mean: 210000 },
    { key: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)', max: 180000, mean: 180000 },
    { key: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)', max: 150000, mean: 150000 },
    { key: 'PARTIAL_REFORM', label: '一部リフォーム', max: 160000, mean: 160000 },
    { key: 'OWNER_OCCUPIED', label: '売主居住中', max: 140000, mean: 140000 },
    { key: 'NEEDS_RENOVATION', label: '改修必要', max: 130000, mean: 130000 },
    { key: 'INVESTMENT_PROPERTY', label: '収益物件', max: null, mean: null },
  ])

  assert.deepEqual(floorSummaries, [
    { floor: 5, max: 110000, mean: 110000, coef: 0.55 },
    { floor: 4, max: 140000, mean: 140000, coef: 0.7 },
    { floor: 3, max: 150000, mean: 140000, coef: 0.7 },
    { floor: 2, max: 180000, mean: 170000, coef: 0.85 },
    { floor: 1, max: 220000, mean: 210000, coef: 1 },
  ])
})

test('resolveReferenceUnitPrice falls back to contract_price / area_sqm when unit_price is null', () => {
  assert.equal(
    resolveReferenceUnitPrice({
      floor: 1,
      area_sqm: 50,
      contract_price: 10000000,
      unit_price: null,
      condition_status: 'FULL_RENO_INSULATED',
    }),
    200000,
  )
})

test('rows with null condition_status are excluded from condition summaries and included in floor summaries', () => {
  const { conditionSummaries, floorSummaries } = buildReferenceValueSummaries(baseRows)

  assert.equal(conditionSummaries.find((row) => row.key === 'INVESTMENT_PROPERTY')?.max, null)
  assert.deepEqual(floorSummaries.find((row) => row.floor === 5), { floor: 5, max: 110000, mean: 110000, coef: 0.55 })
})

test('floor 1 stays in the floor summary with fixed coef 1 even when there are no first-floor rows', () => {
  const { floorSummaries } = buildReferenceValueSummaries(baseRows.filter((row) => row.floor !== 1))

  assert.deepEqual(floorSummaries, [
    { floor: 5, max: 110000, mean: 110000, coef: 0.55 },
    { floor: 4, max: 140000, mean: 140000, coef: 0.7 },
    { floor: 3, max: 150000, mean: 140000, coef: 0.7 },
    { floor: 2, max: 180000, mean: 170000, coef: 0.85 },
    { floor: 1, max: null, mean: null, coef: 1 },
  ])
})
