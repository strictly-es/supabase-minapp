'use client'

import Link from 'next/link'
import { type ChangeEvent } from 'react'
import { draftEqualsRow, rowToDraft, type EntryDraft } from '@/lib/entryDrafts'
import { diffDays, effectiveUnitPrice, formatUnitPrice } from '@/lib/entryMath'
import { STATUS_OPTIONS, type ComplexOption, type EntryRow } from './tabListShared'

type Props = {
  entries: EntryRow[]
  filteredAndSorted: EntryRow[]
  drafts: Record<string, EntryDraft>
  selectedComplex: ComplexOption | null
  locationText: string
  stationText: string
  stationWalkText: string
  openingPdfId: string | null
  deletingId: string | null
  savingId: string | null
  loadingEntries: boolean
  onDraftChange: (entryId: string, key: keyof EntryDraft) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onResetDraft: (entryId: string) => void
  onSave: (entryId: string) => void
  onDelete: (entryId: string) => void
  onOpenPdf: (entryId: string, path: string | null) => void
}

export function TabListTable({
  entries,
  filteredAndSorted,
  drafts,
  selectedComplex,
  locationText,
  stationText,
  stationWalkText,
  openingPdfId,
  deletingId,
  savingId,
  loadingEntries,
  onDraftChange,
  onResetDraft,
  onSave,
  onDelete,
  onOpenPdf,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-[2300px] w-full text-xs">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="text-left p-2 border-b">#</th>
            <th className="text-left p-2 border-b">ラベル</th>
            <th className="text-left p-2 border-b">1 団地名</th>
            <th className="text-left p-2 border-b">2 所在地</th>
            <th className="text-left p-2 border-b">3 最寄り駅</th>
            <th className="text-left p-2 border-b">4 最寄り駅からの徒歩時間</th>
            <th className="text-left p-2 border-b">5 総戸数</th>
            <th className="text-left p-2 border-b">6 エレベーター</th>
            <th className="text-left p-2 border-b">7 築年月</th>
            <th className="text-left p-2 border-b">8 棟番号</th>
            <th className="text-left p-2 border-b">9 階数</th>
            <th className="text-left p-2 border-b">10 成約価格</th>
            <th className="text-left p-2 border-b">11 ㎡数</th>
            <th className="text-left p-2 border-b">12 ㎡単価</th>
            <th className="text-left p-2 border-b">13 レインズ登録年月日</th>
            <th className="text-left p-2 border-b">14 レインズ成約年月日</th>
            <th className="text-left p-2 border-b">15 経過日数</th>
            <th className="text-left p-2 border-b">16 状態</th>
            <th className="text-left p-2 border-b">PDF</th>
            <th className="text-left p-2 border-b">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSorted.map((row, idx) => {
            const originalRow = entries.find((item) => item.id === row.id) ?? row
            const draft = drafts[row.id] ?? rowToDraft(originalRow)
            const isDirty = Boolean(drafts[row.id]) && !draftEqualsRow(draft, originalRow)
            const unitPrice = effectiveUnitPrice(row)
            const elapsedDays = diffDays(row.reins_registered_date, row.contract_date)
            return (
              <tr key={row.id} className="border-b align-top hover:bg-gray-50">
                <td className="p-2">{idx + 1}</td>
                <td className="p-2">
                  <select className="w-20 border rounded px-2 py-1 bg-white" value={draft.contract_kind} onChange={onDraftChange(row.id, 'contract_kind')}>
                    <option value="">なし</option>
                    <option value="MAX">MAX</option>
                    <option value="MINI">MINI</option>
                  </select>
                </td>
                <td className="p-2">{selectedComplex?.name ?? '—'}</td>
                <td className="p-2">{locationText}</td>
                <td className="p-2">{stationText}</td>
                <td className="p-2">{stationWalkText}</td>
                <td className="p-2">{selectedComplex?.unitCount != null ? `${selectedComplex.unitCount}戸` : '—'}</td>
                <td className="p-2">
                  <select className="w-24 border rounded px-2 py-1 bg-white" value={draft.has_elevator} onChange={onDraftChange(row.id, 'has_elevator')}>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                    <option value="スキップ">スキップ</option>
                  </select>
                </td>
                <td className="p-2"><input type="month" className="w-36 border rounded px-2 py-1 bg-white" value={draft.built_month} onChange={onDraftChange(row.id, 'built_month')} /></td>
                <td className="p-2"><input type="number" min={0} step={1} className="w-20 border rounded px-2 py-1 bg-white" value={draft.building_no} onChange={onDraftChange(row.id, 'building_no')} /></td>
                <td className="p-2"><input type="number" min={0} step={1} className="w-20 border rounded px-2 py-1 bg-white" value={draft.floor} onChange={onDraftChange(row.id, 'floor')} /></td>
                <td className="p-2"><input type="number" min={0} step={1} className="w-32 border rounded px-2 py-1 bg-white" value={draft.contract_price} onChange={onDraftChange(row.id, 'contract_price')} /></td>
                <td className="p-2"><input type="number" min={0} step={0.01} className="w-28 border rounded px-2 py-1 bg-white" value={draft.area_sqm} onChange={onDraftChange(row.id, 'area_sqm')} /></td>
                <td className="p-2">{formatUnitPrice(unitPrice)}</td>
                <td className="p-2"><input type="date" className="w-40 border rounded px-2 py-1 bg-white" value={draft.reins_registered_date} onChange={onDraftChange(row.id, 'reins_registered_date')} /></td>
                <td className="p-2"><input type="date" className="w-40 border rounded px-2 py-1 bg-white" value={draft.contract_date} onChange={onDraftChange(row.id, 'contract_date')} /></td>
                <td className="p-2">{elapsedDays == null ? '—' : `${elapsedDays}日`}</td>
                <td className="p-2">
                  <select className="w-56 border rounded px-2 py-1 bg-white" value={draft.condition_status} onChange={onDraftChange(row.id, 'condition_status')}>
                    <option value="">選択</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  {row.mysoku_pdf_path ? (
                    <button
                      type="button"
                      className="underline text-blue-700 disabled:opacity-50"
                      disabled={openingPdfId === row.id}
                      onClick={() => onOpenPdf(row.id, row.mysoku_pdf_path)}
                    >
                      {openingPdfId === row.id ? '表示中...' : '表示'}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className="underline text-green-700 mr-2 disabled:opacity-50"
                    onClick={() => onSave(row.id)}
                    disabled={!isDirty || savingId === row.id}
                  >
                    {savingId === row.id ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="underline text-gray-600 mr-2 disabled:opacity-50"
                    onClick={() => onResetDraft(row.id)}
                    disabled={!drafts[row.id] || savingId === row.id}
                  >
                    元に戻す
                  </button>
                  <Link className="underline text-blue-700 mr-2" href={`/tab-regist/${encodeURIComponent(row.id)}/edit`}>
                    編集
                  </Link>
                  <button
                    type="button"
                    className="underline text-red-700 disabled:opacity-50"
                    onClick={() => onDelete(row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? '削除中...' : '削除'}
                  </button>
                  {isDirty && <div className="mt-1 text-[10px] text-amber-700">未保存</div>}
                </td>
              </tr>
            )
          })}
          {!loadingEntries && filteredAndSorted.length === 0 && (
            <tr>
              <td className="p-6 text-sm text-gray-500" colSpan={20}>条件に一致する成約がありません。</td>
            </tr>
          )}
          {loadingEntries && (
            <tr>
              <td className="p-6 text-sm text-gray-500" colSpan={20}>読み込み中...</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
