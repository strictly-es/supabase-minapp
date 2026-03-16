'use client'

import type { DetailFormChangeHandler, FormState } from './detailEditShared'

type DetailPerformanceSectionProps = {
  form: FormState
  onChange: DetailFormChangeHandler
}

export default function DetailPerformanceSection({
  form,
  onChange,
}: DetailPerformanceSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">成約実績・属性</h3>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <label className="block">レインズにて登録した年月日
          <input name="reins_registered_date" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.reins_registered_date} onChange={onChange('reins_registered_date')} />
        </label>
        <label className="block">成約年月日
          <input name="contract_date" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.contract_date} onChange={onChange('contract_date')} />
        </label>
        <label className="block">max price（円）
          <input name="max_price" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="12000000" value={form.max_price} onChange={onChange('max_price')} />
        </label>
        <label className="block">面積（㎡）
          <input name="area_sqm" type="number" min={0} step={0.01} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="68.32" value={form.area_sqm} onChange={onChange('area_sqm')} />
        </label>
        <label className="block">内装レベル係数
          <select name="interior_level_coef" className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" value={form.interior_level_coef} onChange={onChange('interior_level_coef')}>
            <option value="">選択</option>
            <option value="1.00">1.00</option>
            <option value="1.05">1.05</option>
            <option value="1.10">1.10</option>
            <option value="1.15">1.15</option>
            <option value="1.20">1.20</option>
          </select>
        </label>
        <label className="block">成約年数上乗せ係数
          <select name="contract_year_coef" className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" value={form.contract_year_coef} onChange={onChange('contract_year_coef')}>
            <option value="">選択</option>
            <option value="0.00">1年未満(0.00)</option>
            <option value="0.02">1~2年前(0.02)</option>
            <option value="0.04">2~3年前(0.04)</option>
            <option value="0.06">3~5年前(0.06)</option>
            <option value="0.08">5年以上前(0.08)</option>
            <option value="0.1">10年以上前(0.1)</option>
          </select>
        </label>
        <label className="block">過去MIN価格
          <input name="past_min" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="4800000" value={form.past_min} onChange={onChange('past_min')} />
        </label>
      </div>
    </section>
  )
}
