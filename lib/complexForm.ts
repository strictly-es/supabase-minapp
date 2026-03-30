import { formatUnitPrice } from './entryMath.ts'

export function calcBuiltAge(builtYm: string, now: Date = new Date()): number | null {
  if (!builtYm) return null
  const builtDate = new Date(`${builtYm}-01`)
  if (Number.isNaN(builtDate.getTime())) return null
  let years = now.getFullYear() - builtDate.getFullYear()
  const monthDiff = now.getMonth() - builtDate.getMonth()
  if (monthDiff < 0) years -= 1
  return years >= 0 && Number.isFinite(years) ? years : null
}

export function formatComplexUnitPrice(value: number | null): string {
  return formatUnitPrice(value)
}

export function parseMonthlyAmount(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function calcComplexMonthlyCostTotal(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((sum, value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? sum + value : sum
    if (typeof value === 'string') {
      const parsed = parseMonthlyAmount(value)
      return parsed != null ? sum + parsed : sum
    }
    return sum
  }, 0)
}
