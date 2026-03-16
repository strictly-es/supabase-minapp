'use client'

import { formatYenNumber } from '@/lib/detailSummary'
import type { DetailComputedSummary } from './detailShared'

type Props = {
  computed: DetailComputedSummary | null
}

export default function DetailKpiCards({ computed }: Props) {
  return (
    <section className="grid md:grid-cols-5 gap-3">
      <div className="rounded-2xl bg-lime-50 p-4"><div className="text-xs text-gray-500">㎡単価</div><div className="text-2xl font-semibold"><span className="num">{computed ? formatYenNumber(computed.unit) : '-'}</span><span className="text-sm"> 円/㎡</span></div></div>
      <div className="rounded-2xl bg-indigo-50 p-4"><div className="text-xs text-gray-500">目標成約価格</div><div className="text-2xl font-semibold"><span className="num">{computed ? formatYenNumber(computed.targetClose) : '-'}</span><span className="text-sm"> 円</span></div></div>
      <div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs text-gray-500">募集総額</div><div className="text-2xl font-semibold"><span className="num">{computed ? formatYenNumber(computed.raise) : '-'}</span><span className="text-sm"> 円</span></div></div>
      <div className="rounded-2xl bg-rose-50 p-4"><div className="text-xs text-gray-500">過去MIN（令和）</div><div className="text-2xl font-semibold"><span className="num">{computed ? formatYenNumber(computed.pastMin) : '-'}</span><span className="text-sm"> 円</span></div></div>
      <div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs text-gray-500">買付目標額</div><div className="text-2xl font-semibold"><span className="num">{computed ? formatYenNumber(computed.buyTarget) : '-'}</span><span className="text-sm"> 円</span></div></div>
    </section>
  )
}
