'use client'

import { formatJaDate, formatYenNumber } from '@/lib/detailSummary'
import type { DetailComputedSummary, DetailRow } from './detailShared'

type Props = {
  row: DetailRow | null
  computed: DetailComputedSummary | null
  signedUrl: string | null
}

export default function DetailOverviewSection({ row, computed, signedUrl }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold">詳細</h3>
      <dl className="grid md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
        <div><dt className="text-gray-500">団地名</dt><dd className="font-medium">{computed?.name ?? '-'}</dd></div>
        <div><dt className="text-gray-500">所在地（都道府県/市/町村）</dt><dd>{computed?.addr || '-'}</dd></div>
        <div><dt className="text-gray-500">管理</dt><dd>{row?.management || '-'}</dd></div>
        <div><dt className="text-gray-500">階数（入力）</dt><dd className="num">{row?.floor ?? '-'}</dd></div>
        <div><dt className="text-gray-500">エレベーター有無</dt><dd>{row?.has_elevator === true ? '有' : row?.has_elevator === false ? '無' : '-'}</dd></div>
        <div><dt className="text-gray-500">面積（㎡）</dt><dd className="num">{computed ? computed.area.toFixed(2) : '-'}</dd></div>
        <div><dt className="text-gray-500">㎡単価（成約/㎡）</dt><dd className="num">{computed ? formatYenNumber(computed.unit) : '-'}</dd></div>
        <div><dt className="text-gray-500">登録年月日</dt><dd>{formatJaDate(row?.reins_registered_date ?? null)}</dd></div>
        <div><dt className="text-gray-500">成約年月日</dt><dd>{formatJaDate(row?.contract_date ?? null)}</dd></div>
        <div><dt className="text-gray-500">添付（マイソクPDF）</dt><dd>{signedUrl ? <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">確認</a> : '-'}</dd></div>
      </dl>
    </section>
  )
}
