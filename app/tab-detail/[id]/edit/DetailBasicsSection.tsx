'use client'

import type { DetailFormChangeHandler, FormState } from './detailEditShared'

type DetailBasicsSectionProps = {
  form: FormState
  existingPdfUrl: string | null
  signedUrl: string | null
  onChange: DetailFormChangeHandler
  onPdfChange: (file: File | null) => void
}

export default function DetailBasicsSection({
  form,
  existingPdfUrl,
  signedUrl,
  onChange,
  onPdfChange,
}: DetailBasicsSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">基本情報</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <label className="block">団地名
          <input name="estate_name" type="text" required className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）湘南パーク団地" value={form.estate_name} onChange={onChange('estate_name')} />
        </label>
        <label className="block">管理
          <select name="management" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.management} onChange={onChange('management')}>
            <option value="">選択</option>
            <option value="一部委託">一部委託</option>
            <option value="自主管理">自主管理</option>
            <option value="全部委託">全部委託</option>
          </select>
        </label>
        <label className="block">都道府県
          <select name="pref" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.pref} onChange={onChange('pref')}>
            <option value="兵庫">兵庫</option>
            <option value="大阪">大阪</option>
            <option value="">選択</option>
          </select>
        </label>
        <label className="block">所在地1
          <input name="addr1" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）藤沢市鵠沼神明" value={form.addr1} onChange={onChange('addr1')} />
        </label>
        <label className="block md:col-span-2">所在地2
          <input name="addr2" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3-2-402" value={form.addr2} onChange={onChange('addr2')} />
        </label>
        <div className="md:col-span-2 text-sm">
          <div className="font-medium">PDF（過去成約事例の販売図面・マイソク）</div>
          {existingPdfUrl ? (
            <div className="mt-1 flex items-center gap-3">
              <span className="text-gray-600 text-xs">登録済みPDFあり（置き換え可能）</span>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">確認</a>
              )}
              <input id="pdf" name="mysoku_pdf" type="file" accept="application/pdf" className="w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)} />
            </div>
          ) : (
            <input id="pdf" name="mysoku_pdf" type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)} />
          )}
        </div>
        <label className="block">階数（入力）
          <input name="floor" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="5" value={form.floor} onChange={onChange('floor')} />
        </label>
        <label className="block">エレベーター有無
          <select name="elevator" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.elevator} onChange={onChange('elevator')}>
            <option value="">選択</option>
            <option value="有">有</option>
            <option value="無">無</option>
          </select>
        </label>
      </div>
    </section>
  )
}
