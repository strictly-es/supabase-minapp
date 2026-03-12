export const STOCK_ALERT_LEAD_DAYS = 5

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function diffDays(start: string | null, end: string | null): number | null {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
}

export function diffFromBaseDateDays(date: string | null, baseDate: string | Date): number | null {
  const targetDate = parseDate(date)
  const base = baseDate instanceof Date ? baseDate : parseDate(baseDate)
  if (!targetDate || !base) return null
  return Math.round((base.getTime() - targetDate.getTime()) / 86400000)
}

export function calcStockAlertDays(miniElapsedDays: number | null, leadDays = STOCK_ALERT_LEAD_DAYS): number | null {
  if (typeof miniElapsedDays !== 'number' || !Number.isFinite(miniElapsedDays)) return null
  return Math.max(miniElapsedDays - leadDays, 0)
}

export function shouldShowStockTimingAlert(input: {
  stockCount: number
  stockDaysOldest: number | null
  miniElapsedDays: number | null
  leadDays?: number
}): { stockAlertDays: number | null; showStockTimingAlert: boolean } {
  const stockAlertDays = calcStockAlertDays(input.miniElapsedDays, input.leadDays)
  const showStockTimingAlert =
    input.stockCount > 0 &&
    input.stockDaysOldest != null &&
    stockAlertDays != null &&
    input.stockDaysOldest >= stockAlertDays

  return { stockAlertDays, showStockTimingAlert }
}
