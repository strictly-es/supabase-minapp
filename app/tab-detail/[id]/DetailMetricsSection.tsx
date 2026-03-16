'use client'

import { formatYenNumber } from '@/lib/detailSummary'
import type { DetailComputedSummary, DetailRow } from './detailShared'

type Props = {
  row: DetailRow | null
  computed: DetailComputedSummary | null
}

export default function DetailMetricsSection({ row, computed }: Props) {
  return (
    <>
      <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold">係数</h3>
        <dl className="grid md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div><dt className="text-gray-500">内装レベル 係数</dt><dd className="num">{computed ? computed.interior.toFixed(2) : '-'}</dd></div>
          <div><dt className="text-gray-500">成約年数 上乗せ係数</dt><dd className="num">{computed ? computed.yearCoef.toFixed(2) : '-'}</dd></div>
          <div><dt className="text-gray-500">係数計</dt><dd className="num">{typeof row?.coef_total === 'number' ? row.coef_total.toFixed(2) : '-'}</dd></div>
        </dl>
      </section>

      <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold">買付目標額（参考）</h3>
        <dl className="grid md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-gray-500">買付目標額 × 0.9</dt>
            <dd className="num">{computed ? formatYenNumber(Math.round(computed.buyTarget * 0.9)) : '-'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">買付目標額 × 1.25</dt>
            <dd className="num">{computed ? formatYenNumber(Math.round(computed.buyTarget * 1.25)) : '-'}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
