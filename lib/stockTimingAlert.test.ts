import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STOCK_ALERT_LEAD_DAYS,
  calcStockAlertDays,
  diffDays,
  diffFromBaseDateDays,
  shouldShowStockTimingAlert,
} from './stockTimingAlert.ts'

test('過去MINIの経過日数20日ならアラート基準は15日になる', () => {
  assert.equal(STOCK_ALERT_LEAD_DAYS, 5)
  assert.equal(calcStockAlertDays(20), 15)
})

test('最古在庫の経過日数が基準15日に達していればアラートを表示する', () => {
  const miniElapsedDays = diffDays('2026-01-01', '2026-01-21')
  const stockDaysOldest = diffFromBaseDateDays('2026-02-14', '2026-03-01')

  assert.equal(miniElapsedDays, 20)
  assert.equal(stockDaysOldest, 15)
  assert.deepEqual(
    shouldShowStockTimingAlert({ stockCount: 1, stockDaysOldest, miniElapsedDays }),
    { stockAlertDays: 15, showStockTimingAlert: true },
  )
})

test('最古在庫の経過日数が基準未満ならアラートを表示しない', () => {
  const miniElapsedDays = diffDays('2026-01-01', '2026-01-21')
  const stockDaysOldest = diffFromBaseDateDays('2026-02-15', '2026-03-01')

  assert.equal(miniElapsedDays, 20)
  assert.equal(stockDaysOldest, 14)
  assert.deepEqual(
    shouldShowStockTimingAlert({ stockCount: 1, stockDaysOldest, miniElapsedDays }),
    { stockAlertDays: 15, showStockTimingAlert: false },
  )
})

test('在庫件数が0件なら基準を満たしていてもアラートを表示しない', () => {
  assert.deepEqual(
    shouldShowStockTimingAlert({ stockCount: 0, stockDaysOldest: 15, miniElapsedDays: 20 }),
    { stockAlertDays: 15, showStockTimingAlert: false },
  )
})

test('過去MINIの経過日数が5日未満でも基準は0日で下限固定になる', () => {
  assert.deepEqual(
    shouldShowStockTimingAlert({ stockCount: 1, stockDaysOldest: 0, miniElapsedDays: 3 }),
    { stockAlertDays: 0, showStockTimingAlert: true },
  )
})

test('過去MINIの経過日数が取れない場合はアラートを表示しない', () => {
  assert.deepEqual(
    shouldShowStockTimingAlert({ stockCount: 1, stockDaysOldest: 15, miniElapsedDays: null }),
    { stockAlertDays: null, showStockTimingAlert: false },
  )
})
