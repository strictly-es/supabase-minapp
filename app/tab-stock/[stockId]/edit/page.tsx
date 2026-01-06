'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type Complex = { id: string; name: string; pref: string | null; city: string | null; floorPattern: string | null }
type Entry = { id: string; floor: number | null; area: number | null; layout: string | null; maxPrice: number | null; coefTotal: number | null; reins: string | null; contract: string | null }

type StockRow = {
  id: string
  complex_id: string | null
  estate_entry_id: string | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  registered_date: string | null
  contract_date: string | null
  base_unit_price: number | null
  coef_total: number | null
  stock_mysoku_path: string | null
}

type FormState = {
  floor: string
  area: string
  layout: string
  registered: string
  contract: string
  maxUnit: string
  coefTotal: string
}

type FloorRow = { floor: number; floorCoef: number; targetUnit: number; targetClose: number; raise: number; buyTarget: number }

const floorCoefs: Record<string, number[]> = {
  '①保守的': [1.0, 0.98, 0.95, 0.9, 0.85],
  '②中間': [1.0, 0.99, 0.96, 0.92, 0.88],
  '③攻め': [1.0, 1.0, 0.99, 0.98, 0.97],
  '④超攻め': [0.98, 0.99, 1.0, 1.03, 1.07],
}

const initialForm: FormState = {
  floor: '',
  area: '',
  layout: '',
  registered: '',
  contract: '',
  maxUnit: '',
  coefTotal: '1.00',
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function safeNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toInt(v: string): number | null { return v.trim() === '' ? null : Number.parseInt(v, 10) }
function toNum(v: string): number | null { return v.trim() === '' ? null : Number.parseFloat(v) }
function fmtYen(n: number): string { return n.toLocaleString('ja-JP') + ' 円' }
function fmtUnit(n: number): string { return fmtYen(n) + '/㎡' }
function toDateValue(v: string | null): string { return v ? (v.includes('T') ? v.slice(0, 10) : v) : '' }
function toNumString(v: number | null): string { return typeof v === 'number' && Number.isFinite(v) ? String(v) : '' }
function toFixedString(v: number | null, fallback: string): string { return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : fallback }

export default function StockEditPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ stockId: string }>()
  const stockId = params?.stockId as string | undefined

  const [complexes, setComplexes] = useState<Complex[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState<string>('')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [form, setForm] = useState<FormState>(initialForm)
  const [pdf, setPdf] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [loadingStock, setLoadingStock] = useState(true)
  const [existingPdfPath, setExistingPdfPath] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const selectedComplex = useMemo(() => complexes.find((c) => c.id === selectedComplexId) ?? null, [complexes, selectedComplexId])
  const selectedEntry = useMemo(() => entries.find((e) => e.id === selectedEntryId) ?? null, [entries, selectedEntryId])

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!stockId) {
        if (mounted) {
          setMsg('在庫が見つかりませんでした')
          setLoadingStock(false)
        }
        return
      }
      setLoadingStock(true)
      try {
        const { data, error } = await supabase
          .from('estate_stocks')
          .select('id, complex_id, estate_entry_id, floor, area_sqm, layout, registered_date, contract_date, base_unit_price, coef_total, stock_mysoku_path')
          .eq('id', stockId)
          .maybeSingle()
        if (error) throw error
        const row = (data ?? null) as StockRow | null
        if (!row) {
          if (mounted) setMsg('在庫が見つかりませんでした')
          return
        }
        if (mounted) {
          setSelectedComplexId(row.complex_id ?? '')
          setSelectedEntryId(row.estate_entry_id ?? '')
          setForm({
            floor: toNumString(row.floor),
            area: toNumString(row.area_sqm),
            layout: row.layout ?? '',
            registered: toDateValue(row.registered_date),
            contract: toDateValue(row.contract_date),
            maxUnit: toNumString(row.base_unit_price),
            coefTotal: toFixedString(row.coef_total, initialForm.coefTotal),
          })
          setExistingPdfPath(row.stock_mysoku_path ?? null)
          setSignedUrl(null)
        }
        if (row.stock_mysoku_path) {
          try {
            const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(row.stock_mysoku_path, 600)
            if (mounted) setSignedUrl(signed?.signedUrl ?? null)
          } catch {
            if (mounted) setSignedUrl(null)
          }
        }
      } catch (e) {
        console.error('[stock:edit:load]', e)
        if (mounted) setMsg('読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingStock(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, stockId])

  useEffect(() => {
    let mounted = true
    async function loadComplexes() {
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select('id, name, pref, city, floor_coef_pattern')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        const list = (data ?? []).map((c) => ({
          id: c.id as string,
          name: (c.name as string) ?? '(名称未設定)',
          pref: (c.pref as string | null) ?? null,
          city: (c.city as string | null) ?? null,
          floorPattern: (c.floor_coef_pattern as string | null) ?? null,
        }))
        if (mounted) {
          setComplexes(list)
          if (!selectedComplexId && list[0]) setSelectedComplexId(list[0].id)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase, selectedComplexId])

  useEffect(() => {
    if (!selectedComplexId) { setEntries([]); return }
    let mounted = true
    async function loadEntries() {
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, floor, area_sqm, layout, max_price, coef_total, interior_level_coef, contract_year_coef, reins_registered_date, contract_date, contract_kind')
          .eq('complex_id', selectedComplexId)
          .eq('contract_kind', 'MAX')
          .is('deleted_at', null)
          .order('contract_date', { ascending: false, nullsFirst: false })
          .limit(200)
        if (error) throw error
        const list = (data ?? []).map((r) => ({
          id: r.id as string,
          floor: r.floor as number | null,
          area: (r.area_sqm as number | null) ?? null,
          layout: (r.layout as string | null) ?? null,
          maxPrice: (r.max_price as number | null) ?? null,
          coefTotal: (r.coef_total as number | null) ?? (safeNum(r.interior_level_coef as number | null) + safeNum(r.contract_year_coef as number | null)),
          reins: (r.reins_registered_date as string | null) ?? null,
          contract: (r.contract_date as string | null) ?? null,
        }))
        if (mounted) {
          setEntries(list)
          if (!selectedEntryId && list[0]) setSelectedEntryId(list[0].id)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('過去成約取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadEntries()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, selectedEntryId])

  useEffect(() => {
    if (!selectedEntry) return
    setForm((prev) => ({
      ...prev,
      area: prev.area || (selectedEntry.area != null ? selectedEntry.area.toString() : ''),
      layout: prev.layout || (selectedEntry.layout ?? ''),
      maxUnit: prev.maxUnit || (() => {
        const unit = selectedEntry.area && selectedEntry.maxPrice ? Math.round(selectedEntry.maxPrice / selectedEntry.area) : 0
        return unit ? unit.toString() : ''
      })(),
      coefTotal: prev.coefTotal || (selectedEntry.coefTotal != null ? selectedEntry.coefTotal.toFixed(2) : '1.00'),
    }))
  }, [selectedEntry])

  const baseUnit = useMemo(() => safeNum(form.maxUnit), [form.maxUnit])
  const baseCoef = useMemo(() => safeNum(form.coefTotal) || 1, [form.coefTotal])
  const areaNum = useMemo(() => safeNum(form.area), [form.area])

  const floors: FloorRow[] = useMemo(() => {
    const pattern = selectedComplex?.floorPattern ?? ''
    const coefList = floorCoefs[pattern] ?? [1, 1, 1, 1, 1]
    return coefList.map((c, idx) => {
      const targetUnit = Math.round(baseUnit * baseCoef * c)
      const targetClose = Math.round(targetUnit * areaNum)
      const raise = Math.floor((targetClose / 1.21) / 10000) * 10000
      const moveCost = areaNum < 60 ? Math.round(areaNum * 132000) : (areaNum >= 80 ? Math.round(areaNum * 123000) : Math.round(areaNum * (132000 - (areaNum - 60) * 400)))
      const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
      const other = Math.round(raise * 0.075)
      const buyTarget = raise - moveCost - brokerage - other
      return { floor: idx + 1, floorCoef: c, targetUnit, targetClose, raise, buyTarget }
    })
  }, [selectedComplex?.floorPattern, baseUnit, baseCoef, areaNum])

  const selectedFloorNum = useMemo(() => {
    const n = Number.parseInt(form.floor, 10)
    return Number.isFinite(n) ? n : null
  }, [form.floor])
  const selectedFloorRow = floors.find((f) => f.floor === selectedFloorNum) ?? floors[0]

  const onFormChange = <K extends keyof FormState>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function uploadPdf(file: File | null, userId: string): Promise<string | null> {
    if (!file) return null
    const sanitized = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const path = `${userId}/stock/${Date.now()}-${sanitized}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: false, contentType: 'application/pdf' })
    if (error) throw new Error('PDFアップロード失敗: ' + error.message)
    return path
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!stockId) { setMsg('在庫が見つかりません'); return }
    setSaving(true); setMsg('更新中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); setSaving(false); return }
      if (!selectedComplexId) { setMsg('団地を選択してください'); setSaving(false); return }
      if (!selectedEntryId) { setMsg('紐づく過去成約（MAX）を選択してください'); setSaving(false); return }
      const area = toNum(form.area)
      if (!area || area <= 0) { setMsg('面積を入力してください'); setSaving(false); return }

      const stock_mysoku_path = await uploadPdf(pdf, user.id)
      const target = selectedFloorRow
      const payload: Record<string, unknown> = {
        estate_entry_id: selectedEntryId,
        complex_id: selectedComplexId,
        floor: toInt(form.floor),
        area_sqm: area,
        layout: form.layout.trim() || null,
        registered_date: form.registered || null,
        contract_date: form.contract || null,
        list_price: target?.targetClose ?? null,
        base_unit_price: baseUnit || null,
        coef_total: baseCoef || null,
        floor_coef: target?.floorCoef ?? null,
        target_unit_price: target?.targetUnit ?? null,
        target_close_price: target?.targetClose ?? null,
        raise_price: target?.raise ?? null,
        buy_target_price: target?.buyTarget ?? null,
      }
      if (stock_mysoku_path) payload.stock_mysoku_path = stock_mysoku_path

      const { error: upErr } = await supabase
        .from('estate_stocks')
        .update(payload)
        .eq('id', stockId)
      if (upErr) throw new Error('DB更新失敗: ' + upErr.message)

      setMsg('更新しました')
      router.push(`/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}`)
    } catch (e) {
      console.error('[stock:update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <h1 className="text-lg font-semibold">在庫（検討）物件編集</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserEmail />
              <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}>
                サインアウト
              </button>
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
            <ul className="flex flex-wrap gap-2 text-sm">
              <li><Link href="/tab-complex-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地一覧</Link></li>
              <li><Link href="/tab-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約一覧</Link></li>
              <li><Link href="/tab-stock" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫一覧</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">在庫編集</span></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={selectedComplexId ? `/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}` : '/tab-stock'}
                    className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm"
                  >
                    ← 戻る
                  </Link>
                  <h2 className="text-lg font-semibold">団地 / 過去成約 に紐づく在庫編集</h2>
                </div>
                <span className="text-sm text-gray-500">{msg || '内容を更新してください'}</span>
              </div>

              {loadingStock ? (
                <p className="text-sm text-gray-500">読み込み中...</p>
              ) : !stockId ? (
                <p className="text-sm text-red-600">在庫が見つかりませんでした</p>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <label className="block">団地を選択
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedComplexId} onChange={(e) => { setSelectedComplexId(e.target.value); setSelectedEntryId('') }}>
                        {complexes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.pref ? ` (${c.pref}${c.city ? ` ${c.city}` : ''})` : ''}</option>
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
                    <p className="text-gray-700">目標販売成約価格 = (MAX成約単価 ㎡) × (内装+年数係数) × 階数効用比率 × 面積。</p>
                    <p className="text-gray-700">買付目標額 = 募集総額（目標成約価格/1.21） - リノベ予算 - アップフロント - その他。</p>
                  </div>

                  <form id="form-stock" className="space-y-6" onSubmit={(ev) => { handleSubmit(ev).catch(console.error) }}>
                    <section className="space-y-4">
                      <h3 className="font-semibold">物件情報</h3>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <label className="block">紐づく過去成約（MAX）
                          <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedEntryId} onChange={(e) => setSelectedEntryId(e.target.value)}>
                            {entries.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.contract ?? '日付不明'} / {e.floor != null ? `${e.floor}F` : '階不明'} / {e.area != null ? `${e.area.toFixed(1)}㎡` : '面積不明'}
                              </option>
                            ))}
                            {entries.length === 0 && <option value="">MAX成約がありません</option>}
                          </select>
                        </label>
                        <label className="block">階数<input name="floor" type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="5" value={form.floor} onChange={onFormChange('floor')} /></label>
                        <label className="block">面積（㎡）<input name="area" type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="55.20" value={form.area} onChange={onFormChange('area')} /></label>
                        <label className="block">間取り<input name="layout" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3LDK" value={form.layout} onChange={onFormChange('layout')} /></label>
                        <label className="block">登録年月日<input name="registered" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.registered} onChange={onFormChange('registered')} /></label>
                        <label className="block">成約（予定）年月日<input name="contract" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.contract} onChange={onFormChange('contract')} /></label>
                        <label className="block md:col-span-3">マイソク添付
                          <input type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                          {existingPdfPath ? (
                            <p className="mt-1 text-xs text-gray-500">
                              既存PDF: {signedUrl ? (
                                <a className="underline text-blue-700" href={signedUrl} target="_blank" rel="noreferrer">ダウンロード</a>
                              ) : '取得中...'}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">既存PDFなし</p>
                          )}
                        </label>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-semibold">計算（目標販売成約価格 / 買付目標額）</h3>
                      <div className="grid md:grid-cols-4 gap-4 text-sm">
                        <label className="block">MAX成約単価（円/㎡）
                          <input name="max_unit" type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="350000" value={form.maxUnit} onChange={onFormChange('maxUnit')} />
                        </label>
                        <label className="block">係数（内装 + 年数）
                          <input name="coef_total" type="number" min="0" step="0.01" value={form.coefTotal} className="mt-1 w-full border rounded-lg px-3 py-2 num" onChange={onFormChange('coefTotal')} />
                        </label>
                        <div className="block rounded-xl border border-gray-200 p-3 bg-gray-50 md:col-span-2">
                          <div className="text-gray-500 text-xs">階数効用 参考</div>
                          <div className="text-xs text-gray-600">①保守的: 1F 1.00 / 2F 0.98 / 3F 0.95 / 4F 0.90 / 5F 0.85</div>
                          <div className="text-xs text-gray-600">②中間: 1.00 / 0.99 / 0.96 / 0.92 / 0.88</div>
                          <div className="text-xs text-gray-600">③攻め: 1.00 / 1.00 / 0.99 / 0.98 / 0.97</div>
                          <div className="text-xs text-gray-600">④超攻め: 0.98 / 0.99 / 1.00 / 1.03 / 1.07</div>
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
                            {floors.map((f) => (
                              <tr className={`border-t ${selectedFloorNum === f.floor ? 'bg-amber-50' : ''}`} key={f.floor}>
                                <td className="py-2 px-2">{f.floor}F</td>
                                <td className="py-2 px-2 text-right num">{f.targetUnit ? fmtUnit(f.targetUnit) : '—'}</td>
                                <td className="py-2 px-2 text-right num">{f.targetClose ? fmtYen(f.targetClose) : '—'}</td>
                                <td className="py-2 px-2 text-right num">{f.raise ? fmtYen(f.raise) : '—'}</td>
                                <td className="py-2 px-2 text-right text-emerald-700 font-semibold num">{f.buyTarget ? fmtYen(f.buyTarget) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm" onClick={() => { setForm(initialForm); setPdf(null); setMsg(''); }}>
                        リセット
                      </button>
                      <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white text-sm disabled:opacity-60" disabled={saving}>
                        {saving ? '更新中...' : '更新'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
