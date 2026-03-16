'use client'

import Link from 'next/link'
import { formatYenNumber } from '@/lib/detailSummary'
import type { DetailStock } from './detailShared'

type Props = {
  detailId: string | undefined
  stocks: DetailStock[]
  onDeleteStock: (stockId: string) => void
}

export default function DetailStocksSection({ detailId, stocks, onDeleteStock }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">現在販売中の在庫物件</h3>
        <Link href={`/tab-stock-reg?entryId=${detailId ?? ''}`} className="px-2 py-1 rounded bg-gray-100 text-sm">在庫登録</Link>
      </div>
      {stocks.length === 0 ? (
        <p className="text-sm text-gray-500">現在販売中の在庫はありません</p>
      ) : (
        <ul className="text-sm space-y-1">
          {stocks.map((stock) => (
            <li key={stock.id}>
              {typeof stock.floor === 'number' ? `${stock.floor}階` : '-'}、{typeof stock.area_sqm === 'number' ? `${stock.area_sqm.toFixed(2)}m²` : '-'} 、販売価格 {typeof stock.list_price === 'number' ? `${formatYenNumber(stock.list_price)}円` : '-'}
              {' '}
              <Link href={`/tab-stock/${stock.id}`} className="text-blue-600 underline">詳細</Link>
              {' '}
              <Link href={`/tab-stock/${stock.id}/edit`} className="text-blue-600 underline">編集</Link>
              {' '}
              <button className="text-red-600 underline" onClick={() => onDeleteStock(stock.id)}>削除</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
