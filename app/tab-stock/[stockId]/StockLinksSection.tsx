'use client'

import type { StockDetail } from './stockDetailShared'

type Props = {
  row: StockDetail | null
}

export default function StockLinksSection({ row }: Props) {
  return (
    <>
      <section className="space-y-4">
        <h3 className="font-semibold">ファンド収支事業計画</h3>
        <div className="text-sm">{row?.fundplan_url ? <a href={row.fundplan_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : <span className="text-gray-400">-</span>}</div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">ステータス</h3>
        <div className="text-sm">{row?.status || '-'}</div>
      </section>
    </>
  )
}
