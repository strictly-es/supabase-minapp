'use client'

import { ComplexReferenceSummaries } from '@/app/tab-complex/[id]/edit/ComplexReferenceSummaries'
import { buildYearlyReferenceSummaries } from '@/lib/referenceValue'
import { formatUnit, formatYen } from '@/lib/stockPricing'
import type { StockFormProps } from './stockFormShared'

function fmtCoef(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—'
}

function formatEntryLabel(entry: StockFormProps['entries'][number]): string {
  return `${entry.contract ?? '日付不明'} / ${entry.floor != null ? `${entry.floor}F` : '階不明'} / ${entry.area != null ? `${entry.area.toFixed(1)}㎡` : '面積不明'}`
}

export default function StockForm({
  selectedComplexId,
  complexes,
  selectedEntryId,
  entries,
  selectedComplex,
  selectedEntry,
  form,
  floors,
  selectedFloorNum,
  referenceRows,
  coefTotalDisplay,
  saving,
  submitLabel,
  resetLabel = 'リセット',
  showContractDate = false,
  showOnlySelectedFloorRow = false,
  existingPdf,
  onComplexChange,
  onEntryChange,
  onFormChange,
  onPdfChange,
  onReset,
}: StockFormProps) {
  const floorRowsToDisplay = showOnlySelectedFloorRow && selectedFloorNum != null
    ? floors.filter((floor) => floor.floor === selectedFloorNum)
    : floors
  const yearlyReferenceRows = buildYearlyReferenceSummaries(referenceRows)

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <label className="block">団地を選択
          <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedComplexId} onChange={(e) => onComplexChange(e.target.value)}>
            {complexes.map((complex) => (
              <option key={complex.id} value={complex.id}>
                {complex.name}{complex.pref ? ` (${complex.pref}${complex.city ? ` ${complex.city}` : ''})` : ''}
              </option>
            ))}
            {complexes.length === 0 && <option value="">団地なし（先に登録）</option>}
          </select>
        </label>
        <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
          <div className="text-xs text-gray-600">階数効用パターン</div>
          <div className="font-semibold text-sm">{selectedComplex?.floorPattern || '未設定'}</div>
          <div className="text-xs text-gray-500 mt-1">計算に適用します</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 text-sm space-y-1">
        <div className="font-semibold">計算メモ</div>
        <p className="text-gray-700">目標販売成約価格=(MAX成約m²単価×階層係数)×(年数係数×加点係数)</p>
        <p className="text-gray-700">買付目標額 = 募集総額（目標成約価格/1.21） - リノベ予算 - アップフロント - その他。</p>
      </div>

      <section className="space-y-4">
        <h3 className="font-semibold">物件情報</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <label className="block">紐づく過去成約（MAX）
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedEntryId} onChange={(e) => onEntryChange(e.target.value)}>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {formatEntryLabel(entry)}
                </option>
              ))}
              {entries.length === 0 && <option value="">MAX成約がありません</option>}
            </select>
          </label>
          <label className="block">階数<input name="floor" type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="5" value={form.floor} onChange={onFormChange('floor')} /></label>
          <label className="block">面積（㎡）<input name="area" type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="55.20" value={form.area} onChange={onFormChange('area')} /></label>
          <label className="block">間取り<input name="layout" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3LDK" value={form.layout} onChange={onFormChange('layout')} /></label>
          <label className="block">登録年月日<input name="registered" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.registered} onChange={onFormChange('registered')} /></label>
          {showContractDate && (
            <label className="block">成約（予定）年月日<input name="contract" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.contract ?? ''} onChange={onFormChange('contract')} /></label>
          )}
          <label className="block md:col-span-3">マイソク添付
            <input type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)} />
            {existingPdf?.path ? (
              <p className="mt-1 text-xs text-gray-500">
                既存PDF: {existingPdf.url ? (
                  <a className="underline text-blue-700" href={existingPdf.url} target="_blank" rel="noreferrer">ダウンロード</a>
                ) : '取得中...'}
              </p>
            ) : existingPdf ? (
              <p className="mt-1 text-xs text-gray-400">既存PDFなし</p>
            ) : null}
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">計算（目標販売成約価格 / 買付目標額）</h3>
        <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
          <label className="block">
            <span className="block text-xs leading-5 text-gray-600">MAX成約単価</span>
            <span className="block text-sm leading-5">（円/㎡）</span>
            <input name="max_unit" type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="350000" value={form.maxUnit} onChange={onFormChange('maxUnit')} />
          </label>
          <label className="block">
            <span className="block text-xs leading-5 text-gray-600">在庫物件の設定単価</span>
            <span className="block text-sm leading-5">(MAX成約単価×階層係数)</span>
            <input name="coef_total" type="number" min="0" step="0.01" value={form.coefTotal} className="mt-1 w-full border rounded-lg px-3 py-2 num" onChange={onFormChange('coefTotal')} />
          </label>
          <label className="block">
            <span className="block text-xs leading-5 text-gray-600">年数係数</span>
            <span className="block text-sm leading-5">(1年間の伸び率の平均×年数)</span>
            <input name="year_coef" type="number" min="0" step="0.01" value={form.yearCoef} className="mt-1 w-full border rounded-lg px-3 py-2 num" onChange={onFormChange('yearCoef')} />
          </label>
          <label className="block">
            <span className="block text-xs leading-5 text-gray-600">その他</span>
            <span className="block text-sm leading-5">加点係数</span>
            <input name="other_coef" type="number" min="0" step="0.01" value={form.otherCoef} className="mt-1 w-full border rounded-lg px-3 py-2 num" onChange={onFormChange('otherCoef')} />
          </label>
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 self-end">
            <div className="block text-xs leading-5 text-gray-600">＝ 係数合計</div>
            <div className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 num">
              {coefTotalDisplay || '—'}
            </div>
          </div>
          <div className="md:col-span-4 space-y-2">
            {selectedEntry && (selectedEntry.interiorCoef != null || selectedEntry.yearCoef != null) && (
              <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                <div className="text-gray-500 text-xs">過去MAXの係数（内装 / 年数）</div>
                <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">内装レベル係数</div>
                    <div className="font-semibold">{fmtCoef(selectedEntry.interiorCoef)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">成約年月日 上乗せ係数</div>
                    <div className="font-semibold">{fmtCoef(selectedEntry.yearCoef)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-50">
          <table className="w-full text-xs">
            <thead className="text-gray-600 bg-gray-100">
              <tr>
                <th className="text-left py-2 px-2">階</th>
                <th className="text-right py-2 px-2">目標単価（階効用込み）</th>
                <th className="text-right py-2 px-2">目標販売成約価格</th>
                <th className="text-right py-2 px-2">募集総額（目安）</th>
                <th className="text-right py-2 px-2">買付目標額</th>
              </tr>
            </thead>
            <tbody>
              {floorRowsToDisplay.map((floor) => (
                <tr className={`border-t ${selectedFloorNum === floor.floor ? 'bg-amber-50' : ''}`} key={floor.floor}>
                  <td className="py-2 px-2">{floor.floor}F</td>
                  <td className="py-2 px-2 text-right num">{floor.targetUnit ? formatUnit(floor.targetUnit) : '—'}</td>
                  <td className="py-2 px-2 text-right num">{floor.targetClose ? formatYen(floor.targetClose) : '—'}</td>
                  <td className="py-2 px-2 text-right num">{floor.raise ? formatYen(floor.raise) : '—'}</td>
                  <td className="py-2 px-2 text-right text-emerald-700 font-semibold num">{floor.buyTarget ? formatYen(floor.buyTarget) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-50">
          <table className="w-full text-xs">
            <thead className="text-gray-600 bg-gray-100">
              <tr>
                <th className="text-left py-2 px-2">年度</th>
                <th className="text-right py-2 px-2">平均㎡単価</th>
                <th className="text-right py-2 px-2">成約件数</th>
              </tr>
            </thead>
            <tbody>
              {yearlyReferenceRows.map((row) => (
                <tr className="border-t" key={row.year}>
                  <td className="py-2 px-2 num">{row.year}</td>
                  <td className="py-2 px-2 text-right num">{row.meanUnitPrice.toLocaleString('ja-JP')}</td>
                  <td className="py-2 px-2 text-right num">{row.contractCount.toLocaleString('ja-JP')}件</td>
                </tr>
              ))}
              {yearlyReferenceRows.length === 0 && (
                <tr className="border-t">
                  <td className="py-2 px-2 text-gray-500" colSpan={3}>年度別の過去成約データはありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ComplexReferenceSummaries
          referenceRows={referenceRows}
          maxFloor={selectedComplex?.floorCount ?? null}
          hideMaxCoefColumns
        />
      </section>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm" onClick={onReset}>
          {resetLabel}
        </button>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white text-sm disabled:opacity-60" disabled={saving}>
          {saving ? `${submitLabel}中...` : submitLabel}
        </button>
      </div>
    </>
  )
}
