import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildYearlyReferenceSummaries,
  buildReferenceValueTables,
  buildReferenceValueSummaries,
  resolveMaxReferenceValue,
  resolveMeanReferenceCoef,
  resolveYearGrowthCoef,
  resolveYearGrowthCoefResult,
  resolveReferenceUnitPrice,
  type ReferenceValueEntry,
} from './referenceValue.ts'

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
    { key: 'OWNER_OCCUPIED', label: '売主居住中（または居住可能な状態）', max: 140000, mean: 140000 },
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

test('buildReferenceValueTables uses condition-specific max and mean values by floor', () => {
  const { maxRows, meanRows } = buildReferenceValueTables({
    rows: baseRows,
    maxFloor: 6,
  })

  assert.deepEqual(maxRows.slice(0, 3), [
    {
      floor: 1,
      values: {
        FULL_RENO_INSULATED: { value: 220000, coef: 1 },
        FULL_RENO_HIGH_DESIGN: { value: null, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: null, coef: null },
        PARTIAL_REFORM: { value: null, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: null, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
    {
      floor: 2,
      values: {
        FULL_RENO_INSULATED: { value: null, coef: null },
        FULL_RENO_HIGH_DESIGN: { value: 180000, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: null, coef: null },
        PARTIAL_REFORM: { value: 160000, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: null, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
    {
      floor: 3,
      values: {
        FULL_RENO_INSULATED: { value: null, coef: null },
        FULL_RENO_HIGH_DESIGN: { value: null, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: 150000, coef: null },
        PARTIAL_REFORM: { value: null, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: 130000, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
  ])

  assert.deepEqual(meanRows.slice(0, 3), [
    {
      floor: 1,
      values: {
        FULL_RENO_INSULATED: { value: 210000, coef: 1 },
        FULL_RENO_HIGH_DESIGN: { value: null, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: null, coef: null },
        PARTIAL_REFORM: { value: null, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: null, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
    {
      floor: 2,
      values: {
        FULL_RENO_INSULATED: { value: null, coef: null },
        FULL_RENO_HIGH_DESIGN: { value: 180000, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: null, coef: null },
        PARTIAL_REFORM: { value: 160000, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: null, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
    {
      floor: 3,
      values: {
        FULL_RENO_INSULATED: { value: null, coef: null },
        FULL_RENO_HIGH_DESIGN: { value: null, coef: null },
        FULL_REFORM_ALL_EQUIP: { value: 150000, coef: null },
        PARTIAL_REFORM: { value: null, coef: null },
        OWNER_OCCUPIED: { value: null, coef: null },
        NEEDS_RENOVATION: { value: 130000, coef: null },
        INVESTMENT_PROPERTY: { value: null, coef: null },
      },
    },
  ])

  assert.deepEqual(meanRows[5], {
    floor: 6,
    values: {
      FULL_RENO_INSULATED: { value: null, coef: null },
      FULL_RENO_HIGH_DESIGN: { value: null, coef: null },
      FULL_REFORM_ALL_EQUIP: { value: null, coef: null },
      PARTIAL_REFORM: { value: null, coef: null },
      OWNER_OCCUPIED: { value: null, coef: null },
      NEEDS_RENOVATION: { value: null, coef: null },
      INVESTMENT_PROPERTY: { value: null, coef: null },
    },
  })
})

test('max coefficients use each condition`s first-floor max as the baseline', () => {
  const { maxRows } = buildReferenceValueTables({
    rows: [
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 100, condition_status: 'FULL_RENO_INSULATED' },
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 200, condition_status: 'FULL_RENO_INSULATED' },
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 300, condition_status: 'FULL_RENO_INSULATED' },
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 100, condition_status: 'FULL_RENO_HIGH_DESIGN' },
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 300, condition_status: 'FULL_RENO_HIGH_DESIGN' },
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 500, condition_status: 'FULL_RENO_HIGH_DESIGN' },
      { floor: 2, area_sqm: null, contract_price: null, unit_price: 240, condition_status: 'FULL_RENO_INSULATED' },
      { floor: 5, area_sqm: null, contract_price: null, unit_price: 186, condition_status: 'FULL_RENO_INSULATED' },
    ],
    maxFloor: 5,
  })

  assert.deepEqual(maxRows[0].values.FULL_RENO_INSULATED, { value: 300, coef: 1 })
  assert.deepEqual(maxRows[0].values.FULL_RENO_HIGH_DESIGN, { value: 500, coef: 1 })
  assert.deepEqual(maxRows[1].values.FULL_RENO_INSULATED, { value: 240, coef: 0.8 })
  assert.deepEqual(maxRows[4].values.FULL_RENO_INSULATED, { value: 186, coef: 0.62 })
})

test('mean coefficients use each condition`s first-floor average as the baseline', () => {
  const { meanRows } = buildReferenceValueTables({
    rows: [
      { floor: 1, area_sqm: null, contract_price: null, unit_price: 84410.92, condition_status: 'PARTIAL_REFORM' },
      { floor: 5, area_sqm: null, contract_price: null, unit_price: 52667, condition_status: 'PARTIAL_REFORM' },
    ],
    maxFloor: 5,
  })

  assert.deepEqual(meanRows[0].values.PARTIAL_REFORM, { value: 84411, coef: 1 })
  assert.deepEqual(meanRows[4].values.PARTIAL_REFORM, { value: 52667, coef: 0.62 })
})

test('resolveMeanReferenceCoef returns the full-reform mean coefficient for the requested floor', () => {
  const rows: ReferenceValueEntry[] = [
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 200000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 220000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
    { floor: 3, area_sqm: null, contract_price: null, unit_price: 150000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
  ]

  assert.equal(resolveMeanReferenceCoef({ rows, maxFloor: 5, floor: 3 }), 0.71)
  assert.equal(resolveMeanReferenceCoef({ rows, maxFloor: 5, floor: 2 }), null)
  assert.equal(resolveMeanReferenceCoef({ rows, maxFloor: 5, floor: null }), null)
})

test('resolveMaxReferenceValue returns the full-reform max value for the requested floor', () => {
  const rows: ReferenceValueEntry[] = [
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 200000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 220000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
    { floor: 3, area_sqm: null, contract_price: null, unit_price: 150000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
    { floor: 3, area_sqm: null, contract_price: null, unit_price: 170000, condition_status: 'FULL_REFORM_ALL_EQUIP' },
  ]

  assert.equal(resolveMaxReferenceValue({ rows, maxFloor: 5, floor: 3 }), 170000)
  assert.equal(resolveMaxReferenceValue({ rows, maxFloor: 5, floor: 2 }), null)
  assert.equal(resolveMaxReferenceValue({ rows, maxFloor: 5, floor: null }), null)
})

test('buildYearlyReferenceSummaries groups by contract year with average unit price and count', () => {
  const rows: ReferenceValueEntry[] = [
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 150000, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2009-02-01', reins_registered_date: null },
    { floor: 2, area_sqm: null, contract_price: null, unit_price: 160000, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2009-06-15', reins_registered_date: null },
    { floor: 3, area_sqm: null, contract_price: null, unit_price: 158000, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2010-03-20', reins_registered_date: null },
    { floor: 4, area_sqm: 50, contract_price: 7700000, unit_price: null, condition_status: 'OWNER_OCCUPIED', contract_date: '2010-04-01', reins_registered_date: null },
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 140000, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: null },
  ]

  assert.deepEqual(buildYearlyReferenceSummaries(rows), [
    { year: 2009, meanUnitPrice: 155000, contractCount: 2 },
    { year: 2010, meanUnitPrice: 156000, contractCount: 2 },
  ])
})

test('resolveYearGrowthCoef follows the rounded yearly growth calculation from oldest and latest averages', () => {
  const rows: ReferenceValueEntry[] = [
    { floor: 3, area_sqm: null, contract_price: null, unit_price: 175051, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2019-06-01' },
    { floor: 1, area_sqm: null, contract_price: null, unit_price: 149687, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2009-01-01' },
    { floor: 2, area_sqm: null, contract_price: null, unit_price: 180705, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2026-01-01' },
  ]

  assert.equal(resolveYearGrowthCoef({ rows, floor: 3 }), 0.49)
  assert.equal(resolveYearGrowthCoef({ rows, floor: 2 }), 0)
  assert.equal(resolveYearGrowthCoef({ rows, floor: null }), null)
})

test('resolveYearGrowthCoefResult explains why the coefficient is blank', () => {
  assert.deepEqual(
    resolveYearGrowthCoefResult({
      rows: [],
      floor: null,
    }),
    { value: null, reason: '階数を入力すると年数係数を計算できます' },
  )

  assert.deepEqual(
    resolveYearGrowthCoefResult({
      rows: [
        { floor: 1, area_sqm: null, contract_price: null, unit_price: 149687, condition_status: 'FULL_REFORM_ALL_EQUIP', contract_date: '2009-01-01' },
      ],
      floor: 1,
    }),
    { value: null, reason: '年度別平均㎡単価の表に2年分以上のデータがありません' },
  )
})
