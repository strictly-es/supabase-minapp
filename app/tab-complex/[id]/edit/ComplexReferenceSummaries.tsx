'use client'

import { Fragment } from 'react'

import { formatComplexUnitPrice } from '@/lib/complexForm'
import {
  buildReferenceValueTables,
  REFERENCE_VALUE_MATRIX_COLUMNS,
} from '@/lib/referenceValue'
import type { ReferenceSummaryProps } from './complexEditShared'

function formatCoef(value: number | null): string {
  if (value == null) return '—'
  return value.toLocaleString('ja-JP', { minimumFractionDigits: value === 1 ? 0 : 2, maximumFractionDigits: 2 })
}

export function ComplexReferenceSummaries({ referenceRows, maxFloor, hideMaxCoefColumns = false }: ReferenceSummaryProps) {
  const { maxRows, meanRows } = buildReferenceValueTables({
    rows: referenceRows,
    maxFloor,
  })

  const renderTable = (title: string, rows: typeof maxRows, hideCoefColumns = false) => (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">階数</th>
              {REFERENCE_VALUE_MATRIX_COLUMNS.map((column) => (
                <Fragment key={column.key}>
                  <th className="px-3 py-2 text-right whitespace-nowrap">{column.label}</th>
                  {!hideCoefColumns && <th className="px-3 py-2 text-right whitespace-nowrap">係数</th>}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.floor} className="border-t border-gray-200">
                <td className="px-3 py-2 whitespace-nowrap">{row.floor}</td>
                {REFERENCE_VALUE_MATRIX_COLUMNS.map((column) => (
                  <Fragment key={column.key}>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {formatComplexUnitPrice(row.values[column.key].value)}
                    </td>
                    {!hideCoefColumns && (
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {formatCoef(row.values[column.key].coef)}
                      </td>
                    )}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 p-4">
      <div>
        <h4 className="font-semibold">参考値</h4>
        <div className="mt-1 text-xs text-gray-500 space-y-1">
          <div>MAX値 = 各階の過去成約㎡単価の最大値（各項目ごと）</div>
          <div>平均値 = 各階の過去成約㎡単価の平均値（各項目ごと）</div>
          <div>係数 = 1階の値を `1` として計算</div>
        </div>
      </div>
      <div className="grid gap-4">
        {renderTable('MAX値', maxRows, hideMaxCoefColumns)}
        {renderTable('平均値', meanRows)}
      </div>
    </section>
  )
}
