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
