'use client'

import type { StockDerived, StockDetail } from './stockDetailShared'

type Props = {
  row: StockDetail | null
  derived: StockDerived | null
  parseDate: (value: string | null) => string
  yen: (value: number) => string
}

export default function StockPropertySection({ row, derived, parseDate, yen }: Props) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">物件情報</h3>
      <dl className="grid md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
        <div><dt className="text-gray-500">階数</dt><dd>{row?.floor ?? '-'}</dd></div>
        <div><dt className="text-gray-500">m²数</dt><dd className="num">{typeof row?.area_sqm === 'number' ? row.area_sqm.toFixed(2) : '-'}</dd></div>
        <div><dt className="text-gray-500">販売価格</dt><dd className="num">{typeof row?.list_price === 'number' ? yen(row.list_price) : '-'}</dd></div>
        <div><dt className="text-gray-500">m²単価</dt><dd className="num">{derived && !Number.isNaN(derived.unit) ? `${derived.unit.toLocaleString('ja-JP')}` : '-'}</dd></div>
        <div><dt className="text-gray-500">登録年月日</dt><dd>{parseDate(row?.registered_date ?? null)}</dd></div>
        <div><dt className="text-gray-500">経過日数</dt><dd>{derived?.elapsed ?? '-'}</dd></div>
      </dl>
    </section>
  )
}
