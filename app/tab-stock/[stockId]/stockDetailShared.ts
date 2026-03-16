import type { StockDetailRow } from '@/lib/repositories/stocks'

export type StockDetail = StockDetailRow

export type StockDerived = {
  unit: number
  elapsed: string
}
