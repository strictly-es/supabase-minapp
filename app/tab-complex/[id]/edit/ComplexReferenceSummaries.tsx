'use client'

import { formatComplexUnitPrice } from '@/lib/complexForm'
import type { ReferenceSummaryProps } from './complexEditShared'

export function ComplexReferenceSummaries({ conditionSummaries, floorSummaries }: ReferenceSummaryProps) {
  return (
    <>
      <div className="pt-3">
        <div className="text-sm font-medium text-gray-700">参考値（状態別㎡単価）</div>
        <div className="mt-1 text-xs text-gray-500 space-y-1">
          <div>計算式:</div>
          <div>`max` = 各状態に属する過去成約の㎡単価の最大値</div>
          <div>`mean` = 各状態に属する過去成約の㎡単価の平均値</div>
        </div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">状態</th>
                <th className="px-3 py-2 text-right">max</th>
                <th className="px-3 py-2 text-right">mean</th>
              </tr>
            </thead>
            <tbody>
              {conditionSummaries.map((summary) => (
                <tr key={summary.key} className="border-t border-gray-200">
                  <td className="px-3 py-2">{summary.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatComplexUnitPrice(summary.max)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatComplexUnitPrice(summary.mean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-3">
        <div className="text-sm font-medium text-gray-700">参考値（階数別㎡単価・係数）</div>
        <div className="mt-1 text-xs text-gray-500 space-y-1">
          <div>計算式:</div>
          <div>`max` = 各階の過去成約㎡単価の最大値</div>
          <div>`mean` = 各階の過去成約㎡単価の平均値</div>
          <div>`係数` = 1階は1固定、2階以上は `mean ÷ 200000`</div>
          <div>注意: 1階は 平均㎡単価20万とする（固定）</div>
        </div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">階数</th>
                <th className="px-3 py-2 text-right">max</th>
                <th className="px-3 py-2 text-right">mean</th>
                <th className="px-3 py-2 text-right">係数</th>
              </tr>
            </thead>
            <tbody>
              {floorSummaries.map((summary) => (
                <tr key={summary.floor} className="border-t border-gray-200">
                  <td className="px-3 py-2">{summary.floor}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatComplexUnitPrice(summary.max)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatComplexUnitPrice(summary.mean)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {summary.coef != null ? summary.coef.toLocaleString('ja-JP', { minimumFractionDigits: summary.floor === 1 ? 0 : 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
              {floorSummaries.length === 0 && (
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-500" colSpan={4}>階数別参考値はありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
