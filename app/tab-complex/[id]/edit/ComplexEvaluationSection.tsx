'use client'

import { ComplexReferenceSummaries } from './ComplexReferenceSummaries'
import type {
  CategoryTotals,
  EvalChangeHandler,
  EvalOptionsMap,
  EvalState,
  MarketDealsAutoState,
} from './complexEditShared'
import type { ReferenceValueEntry } from '@/lib/referenceValue'

type Props = {
  evalForm: EvalState
  evalOptions: EvalOptionsMap
  marketDealsOptions: Array<{ value: string; label: string; score: number }>
  marketDealsAuto: MarketDealsAutoState
  categoryTotals: CategoryTotals
  totalScore: number
  referenceRows: ReferenceValueEntry[]
  maxFloor: number | null
  saving: boolean
  onEvalChange: EvalChangeHandler
}

export function ComplexEvaluationSection({
  evalForm,
  evalOptions,
  marketDealsOptions,
  marketDealsAuto,
  categoryTotals,
  totalScore,
  referenceRows,
  maxFloor,
  saving,
  onEvalChange,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">評価シート（100点満点）</h3>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div>
            <div className="text-sm text-gray-500">総合点（自動計算）</div>
            <div className="text-3xl font-semibold"><span className="num">{totalScore}</span><span className="text-base text-gray-500"> / 100</span></div>
          </div>
          <div className="text-xs text-gray-500">
            <div>市場性 {categoryTotals.market}</div>
            <div>立地 {categoryTotals.loc}</div>
            <div>建物 {categoryTotals.bld}</div>
            <div>その他 {categoryTotals.plus}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">市場性（20点）</span>
            <span className="text-xs text-gray-500">過去3年</span>
          </div>
          <label className="block">成約事例
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.marketDeals} onChange={onEvalChange('marketDeals')}>
              {marketDealsOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="mt-1 text-xs text-gray-500">
              {marketDealsAuto.value === 'unregistered'
                ? '該当団地の過去成約情報が登録されていません'
                : `直近3年 ${marketDealsAuto.contractCount}件 / 年平均 ${marketDealsAuto.averagePerYear?.toFixed(2) ?? '—'}件 / 戸数比 ${marketDealsAuto.ratioPerUnit != null ? `${(marketDealsAuto.ratioPerUnit * 100).toFixed(2)}%` : '—'}`}
            </div>
          </label>
          <label className="block">賃貸需要
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.rentDemand} onChange={onEvalChange('rentDemand')}>
              {evalOptions.rentDemand.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">需要指数 <span className="text-xs text-gray-500">※売れやすさの指標(直近1年の成約件数÷現在の在庫数)</span>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.inventory} onChange={onEvalChange('inventory')}>
              {evalOptions.inventory.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">立地（25点）</span>
            <span className="text-xs text-gray-500">交通/利便</span>
          </div>
          <label className="block">駅徒歩
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.walk} onChange={onEvalChange('walk')}>
              {evalOptions.walk.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">都心・ターミナルアクセス
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.access} onChange={onEvalChange('access')}>
              {evalOptions.access.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">生活利便性(スーパー、病院、学校、公園の有無)
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.convenience} onChange={onEvalChange('convenience')}>
              {evalOptions.convenience.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">建物（40点）</span>
            <span className="text-xs text-gray-500">規模/管理/設備</span>
          </div>
          <label className="block">団地規模（戸数）
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.scale} onChange={onEvalChange('scale')}>
              {evalOptions.scale.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">エレベーター
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.elevator} onChange={onEvalChange('elevator')}>
              {evalOptions.elevator.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">管理状態
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.mgmt} onChange={onEvalChange('mgmt')}>
              {evalOptions.mgmt.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">外観・共用部
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.appearance} onChange={onEvalChange('appearance')}>
              {evalOptions.appearance.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">駐車場
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.parking} onChange={onEvalChange('parking')}>
              {evalOptions.parking.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">方角・眺望
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.view} onChange={onEvalChange('view')}>
              {evalOptions.view.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">その他加点（15点）</span>
            <span className="text-xs text-gray-500">将来性/支援</span>
          </div>
          <label className="block">将来性（再開発余地）
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.future} onChange={onEvalChange('future')}>
              {evalOptions.future.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">行政による住み替え促進・まちづくりプレイヤーの活動
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.focus} onChange={onEvalChange('focus')}>
              {evalOptions.focus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">高齢者支援等住民サービスの充実度
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.support} onChange={onEvalChange('support')}>
              {evalOptions.support.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="pt-2 border-t mt-2">
            <label className="block text-sm">総合コメント
              <textarea rows={3} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="メモ／定性的な補足" value={evalForm.comment} onChange={onEvalChange('comment')} />
            </label>
          </div>
        </div>
      </div>

      <ComplexReferenceSummaries
        referenceRows={referenceRows}
        maxFloor={maxFloor}
      />

      <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 bg-gray-50">
        <div>
          <div className="text-sm text-gray-500">総合点（自動計算）</div>
          <div className="text-3xl font-semibold"><span className="num">{totalScore}</span><span className="text-base text-gray-500"> / 100</span></div>
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-60" disabled={saving}>
          {saving ? '更新中...' : '更新'}
        </button>
      </div>
    </section>
  )
}
