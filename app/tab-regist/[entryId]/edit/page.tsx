'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type ComplexOption = { id: string; name: string; pref: string | null; city: string | null; floorPattern: string | null }

type YesNo = '' | '有' | '無'

type EntryRow = {
  id: string
  complex_id: string | null
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  interior_level_coef: number | null
  contract_year_coef: number | null
  coef_total: number | null
  renovated: boolean | null
  mysoku_pdf_path: string | null
}

type MaxForm = {
  floor: string
  area: string
  layout: string
  reins: string
  contract: string
  price: string
  interior: string
  year: string
  coefTotal: string
  pdf: File | null
}

type MiniForm = {
  floor: string
  area: string
  layout: string
  reins: string
  contract: string
  price: string
  renovated: YesNo
  coef: string
  pdf: File | null
}

const initialMax: MaxForm = {
  floor: '',
  area: '',
  layout: '',
  reins: '',
  contract: '',
  price: '',
  interior: '1.00',
  year: '0.00',
  coefTotal: '1.00',
  pdf: null,
}

const initialMini: MiniForm = {
  floor: '',
  area: '',
  layout: '',
  reins: '',
  contract: '',
  price: '',
  renovated: '',
  coef: '1.00',
  pdf: null,
}

const floorCoefs: Record<string, number[]> = {
  '①保守的': [1.0, 0.98, 0.95, 0.9, 0.85],
  '②中間': [1.0, 0.99, 0.96, 0.92, 0.88],
  '③攻め': [1.0, 1.0, 0.99, 0.98, 0.97],
  '④超攻め': [0.98, 0.99, 1.0, 1.03, 1.07],
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function safeNum(v: string): number {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function safeNumValue(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toInt(v: string): number | null {
  return v.trim() === '' ? null : Number.parseInt(v, 10)
}

function toNum(v: string): number | null {
  return v.trim() === '' ? null : Number.parseFloat(v)
}

function toBigInt(v: string): number | null {
  return v.trim() === '' ? null : Number.parseInt(v, 10)
}

function fmtYen(n: number): string {
  return n.toLocaleString('ja-JP') + ' 円'
}

function toDateValue(v: string | null): string {
  if (!v) return ''
  return v.includes('T') ? v.slice(0, 10) : v
}

function toNumString(v: number | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

function toFixedString(v: number | null, fallback: string): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : fallback
}

export default function TabRegistPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ entryId: string }>()
  const entryId = params?.entryId as string | undefined

  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState<string>('')
  const [loadingComplex, setLoadingComplex] = useState(false)
  const [entryKind, setEntryKind] = useState<'MAX' | 'MINI' | null>(null)
  const [loadingEntry, setLoadingEntry] = useState(true)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [existingPdfPath, setExistingPdfPath] = useState<string | null>(null)

  const [maxForm, setMaxForm] = useState<MaxForm>(initialMax)
  const [miniForm, setMiniForm] = useState<MiniForm>(initialMini)
  const [savingMax, setSavingMax] = useState(false)
  const [savingMini, setSavingMini] = useState(false)
  const [msg, setMsg] = useState('')

  const selectedComplex = useMemo(() => complexes.find((c) => c.id === selectedComplexId) ?? null, [complexes, selectedComplexId])

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!entryId) {
        if (mounted) {
          setMsg('成約データが見つかりませんでした')
          setLoadingEntry(false)
        }
        return
      }
      setLoadingEntry(true)
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, complex_id, contract_kind, floor, area_sqm, layout, reins_registered_date, contract_date, max_price, past_min, interior_level_coef, contract_year_coef, coef_total, renovated, mysoku_pdf_path')
          .eq('id', entryId)
          .maybeSingle()
        if (error) throw error
        const row = (data ?? null) as EntryRow | null
        if (!row) {
          if (mounted) {
            setEntryKind(null)
            setMsg('成約データが見つかりませんでした')
          }
          return
        }
        const kind = row.contract_kind === 'MAX' || row.contract_kind === 'MINI' ? row.contract_kind : null
        if (mounted) {
          setEntryKind(kind)
          if (row.complex_id) setSelectedComplexId(row.complex_id)
          if (kind === 'MAX') {
            const hasCoefParts = typeof row.interior_level_coef === 'number' || typeof row.contract_year_coef === 'number'
            const derivedCoef = hasCoefParts ? safeNumValue(row.interior_level_coef) + safeNumValue(row.contract_year_coef) : null
            const coefTotal = typeof row.coef_total === 'number'
              ? row.coef_total.toFixed(2)
              : (derivedCoef !== null ? derivedCoef.toFixed(2) : initialMax.coefTotal)
            setMaxForm({
              ...initialMax,
              floor: toNumString(row.floor),
              area: toNumString(row.area_sqm),
              layout: row.layout ?? '',
              reins: toDateValue(row.reins_registered_date),
              contract: toDateValue(row.contract_date),
              price: toNumString(row.max_price),
              interior: toFixedString(row.interior_level_coef, initialMax.interior),
              year: toFixedString(row.contract_year_coef, initialMax.year),
              coefTotal,
              pdf: null,
            })
          } else if (kind === 'MINI') {
            const coefBase = typeof row.coef_total === 'number'
              ? row.coef_total
              : (typeof row.interior_level_coef === 'number' ? row.interior_level_coef : null)
            setMiniForm({
              ...initialMini,
              floor: toNumString(row.floor),
              area: toNumString(row.area_sqm),
              layout: row.layout ?? '',
              reins: toDateValue(row.reins_registered_date),
              contract: toDateValue(row.contract_date),
              price: toNumString(row.past_min),
              renovated: row.renovated === true ? '有' : row.renovated === false ? '無' : '',
              coef: toFixedString(coefBase, initialMini.coef),
              pdf: null,
            })
          }
          setExistingPdfPath(row.mysoku_pdf_path ?? null)
          setSignedUrl(null)
          if (row.mysoku_pdf_path) {
            try {
              const { data: signed } = await supabase
                .storage
                .from('uploads')
                .createSignedUrl(row.mysoku_pdf_path, 600)
              if (mounted) setSignedUrl(signed?.signedUrl ?? null)
            } catch {
              if (mounted) setSignedUrl(null)
            }
          }
        }
      } catch (e) {
        console.error('[entry/load]', e)
        if (mounted) setMsg('成約データの取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingEntry(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, entryId])

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoadingComplex(true)
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select('id, name, pref, city, floor_coef_pattern')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        const opts = (data ?? []).map((r) => ({
          id: r.id as string,
          name: (r.name as string) ?? '(名称未設定)',
          pref: (r.pref as string | null) ?? null,
          city: (r.city as string | null) ?? null,
          floorPattern: (r.floor_coef_pattern as string | null) ?? null,
        }))
        if (mounted) {
          setComplexes(opts)
          if (!entryId && !selectedComplexId && opts[0]) setSelectedComplexId(opts[0].id)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingComplex(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, entryId, selectedComplexId])

  // coefTotal = interior + year を自動同期
  useEffect(() => {
    const newCoef = (safeNum(maxForm.interior) + safeNum(maxForm.year)).toFixed(2)
    if (newCoef !== maxForm.coefTotal) {
      setMaxForm((prev) => ({ ...prev, coefTotal: newCoef }))
    }
  }, [maxForm.interior, maxForm.year, maxForm.coefTotal])

  const maxUnit = useMemo(() => {
    const p = safeNum(maxForm.price)
    const a = safeNum(maxForm.area)
    return a > 0 ? Math.round(p / a) : 0
  }, [maxForm.price, maxForm.area])

  const maxFloorCoef = useMemo(() => {
    const pattern = selectedComplex?.floorPattern ?? ''
    const list = floorCoefs[pattern]
    if (!list || list.length === 0) return 1
    const floor = Number.parseInt(maxForm.floor, 10)
    if (Number.isFinite(floor)) {
      const coef = list[floor - 1]
      if (typeof coef === 'number') return coef
    }
    return list[0]
  }, [selectedComplex?.floorPattern, maxForm.floor])

  const maxTarget = useMemo(() => Math.round(maxUnit * safeNum(maxForm.coefTotal) * maxFloorCoef), [maxUnit, maxForm.coefTotal, maxFloorCoef])

  const miniUnit = useMemo(() => {
    const p = safeNum(miniForm.price)
    const a = safeNum(miniForm.area)
    return a > 0 ? Math.round(p / a) : 0
  }, [miniForm.price, miniForm.area])

  const miniTarget = useMemo(() => Math.round(miniUnit * safeNum(miniForm.coef)), [miniUnit, miniForm.coef])

  const onMaxChange = <K extends keyof MaxForm>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value
    setMaxForm((prev) => ({ ...prev, [key]: val }))
  }
  const onMiniChange = <K extends keyof MiniForm>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value
    setMiniForm((prev) => ({ ...prev, [key]: val }))
  }

  async function uploadPdf(file: File | null, userId: string): Promise<string | null> {
    if (!file) return null
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const path = `${userId}/mysoku/${Date.now()}-${sanitizedName}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: false, contentType: 'application/pdf' })
    if (error) throw new Error('PDFアップロード失敗: ' + error.message)
    return path
  }

  async function handleSubmit(kind: 'MAX' | 'MINI', ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setMsg('')
    if (!entryId) { setMsg('成約データが見つかりません'); return }
    if (!selectedComplex) { setMsg('団地を選択してください'); return }
    if (entryKind && kind !== entryKind) { setMsg('成約種別が一致しません'); return }
    const { data: { user }, error: uerr } = await supabase.auth.getUser()
    if (uerr) { setMsg('認証エラー: ' + uerr.message); return }
    if (!user) { setMsg('ログインが必要です'); return }

    try {
      if (kind === 'MAX') setSavingMax(true); else setSavingMini(true)

      const pdfPath = await uploadPdf(kind === 'MAX' ? maxForm.pdf : miniForm.pdf, user.id)

      if (kind === 'MAX') {
        const payload: Record<string, unknown> = {
          estate_name: selectedComplex.name,
          complex_id: selectedComplex.id,
          floor: toInt(maxForm.floor),
          area_sqm: toNum(maxForm.area),
          layout: maxForm.layout.trim() || null,
          reins_registered_date: maxForm.reins || null,
          contract_date: maxForm.contract || null,
          max_price: toBigInt(maxForm.price),
          past_min: null,
          interior_level_coef: toNum(maxForm.interior),
          contract_year_coef: toNum(maxForm.year),
          coef_total: toNum(maxForm.coefTotal),
          contract_kind: 'MAX',
          renovated: null,
        }
        if (pdfPath) payload.mysoku_pdf_path = pdfPath
        const { error } = await supabase.from('estate_entries').update(payload).eq('id', entryId)
        if (error) throw new Error(error.message)
        setMsg('MAXを更新しました')
      } else {
        const payload: Record<string, unknown> = {
          estate_name: selectedComplex.name,
          complex_id: selectedComplex.id,
          floor: toInt(miniForm.floor),
          area_sqm: toNum(miniForm.area),
          layout: miniForm.layout.trim() || null,
          reins_registered_date: miniForm.reins || null,
          contract_date: miniForm.contract || null,
          max_price: null,
          past_min: toBigInt(miniForm.price),
          interior_level_coef: toNum(miniForm.coef),
          contract_year_coef: null,
          coef_total: toNum(miniForm.coef),
          contract_kind: 'MINI',
          renovated: miniForm.renovated === '有' ? true : miniForm.renovated === '無' ? false : null,
        }
        if (pdfPath) payload.mysoku_pdf_path = pdfPath
        const { error } = await supabase.from('estate_entries').update(payload).eq('id', entryId)
        if (error) throw new Error(error.message)
        setMsg('MINIを更新しました')
      }
      router.push(`/tab-list?complexId=${encodeURIComponent(selectedComplex.id)}`)
    } catch (e) {
      console.error('[entry/update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSavingMax(false); setSavingMini(false)
    }
  }

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <h1 className="text-lg font-semibold">過去成約（MAX / MINI）編集</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserEmail />
              <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}>
                サインアウト
              </button>
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
            <ul className="flex flex-wrap items-center gap-2 text-sm">
              <li><Link href="/tab-complex-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地一覧</Link></li>
              <li><Link href="/tab-complex" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地基本情報</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">過去成約編集</span></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section id="tab-regist" className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={selectedComplexId ? `/tab-list?complexId=${encodeURIComponent(selectedComplexId)}` : '/tab-list'}
                    className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm"
                  >
                    ← 戻る
                  </Link>
                  <h2 className="text-lg font-semibold">団地に紐づく過去成約編集（MAX / MINI）</h2>
                </div>
                <span className="text-sm text-gray-500">{msg || '内容を更新してください'}</span>
              </div>

              {loadingEntry ? (
                <p className="text-sm text-gray-500">読み込み中...</p>
              ) : !entryKind ? (
                <p className="text-sm text-red-600">成約データが見つかりませんでした</p>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <label className="block">団地を選択
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={selectedComplexId}
                        onChange={(e) => setSelectedComplexId(e.target.value)}
                        disabled={loadingComplex}
                      >
                        {complexes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} {c.pref ?? ''}{c.city ? ` ${c.city}` : ''}</option>
                        ))}
                        {complexes.length === 0 && <option value="">団地なし（先に登録してください）</option>}
                      </select>
                    </label>
                    <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                      <div className="text-xs text-gray-600">階数効用パターン</div>
                      <div className="font-semibold text-sm">{selectedComplex?.floorPattern || '未設定'}</div>
                      <div className="text-xs text-gray-500 mt-1">※ 団地基本情報で設定したパターンを参考に計算</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 text-sm">
                    <div className="font-semibold mb-1">計算メモ</div>
                    <p className="text-gray-700">
                      目標成約単価 ＝ 成約㎡単価 × (内装係数 + 年数係数) × 階数効用比率。買付目標額は目標成約価格からリノベ予算・アップフロント・その他を控除して算出（既存ロジック流用予定）。
                    </p>
                  </div>

                  {entryKind === 'MAX' ? (
                    <form className="space-y-6" onSubmit={(ev) => { handleSubmit('MAX', ev).catch(console.error) }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">MAX</span>
                          <h3 className="font-semibold">過去MAX編集（㎡単価/目標単価を知る）</h3>
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-black text-white rounded-lg text-sm disabled:opacity-60" disabled={savingMax || !selectedComplex}>
                          {savingMax ? '更新中...' : '更新'}
                        </button>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <label className="block">階数<input type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="5" value={maxForm.floor} onChange={onMaxChange('floor')} /></label>
                        <label className="block">面積（㎡）<input type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="68.32" value={maxForm.area} onChange={onMaxChange('area')} /></label>
                        <label className="block">間取り<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3LDK" value={maxForm.layout} onChange={onMaxChange('layout')} /></label>
                        <label className="block">登録年月日<input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={maxForm.reins} onChange={onMaxChange('reins')} /></label>
                        <label className="block">成約年月日<input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={maxForm.contract} onChange={onMaxChange('contract')} /></label>
                        <label className="block">過去成約価格（MAX）<input type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="19800000" value={maxForm.price} onChange={onMaxChange('price')} /></label>
                        <label className="block">内装レベル係数
                          <select className="mt-1 w-full border rounded-lg px-3 py-2" value={maxForm.interior} onChange={onMaxChange('interior')}>
                            <option value="">選択</option><option value="1.00">1.00</option><option value="1.05">1.05</option><option value="1.10">1.10</option><option value="1.15">1.15</option><option value="1.20">1.20</option>
                          </select>
                        </label>
                        <label className="block">成約年月日 上乗せ係数
                          <select className="mt-1 w-full border rounded-lg px-3 py-2" value={maxForm.year} onChange={onMaxChange('year')}>
                            <option value="">選択</option>
                            <option value="0.00">1年未満(0.00)</option>
                            <option value="0.02">1~2年前(0.02)</option>
                            <option value="0.04">2~3年前(0.04)</option>
                            <option value="0.06">3~5年前(0.06)</option>
                            <option value="0.08">5年以上前(0.08)</option>
                            <option value="0.10">10年以上前(0.10)</option>
                          </select>
                        </label>
                        <label className="block md:col-span-3">マイソク添付
                          <input type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => setMaxForm((prev) => ({ ...prev, pdf: e.target.files?.[0] ?? null }))} />
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
                      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 text-sm grid md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-gray-500">成約㎡単価</div>
                          <div className="text-2xl font-semibold"><span className="num">{maxUnit ? fmtYen(maxUnit) + '/㎡' : '—'}</span></div>
                        </div>
                        <div>
                          <div className="text-gray-500">係数計（内装 + 年数）</div>
                          <input type="number" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" value={maxForm.coefTotal} onChange={onMaxChange('coefTotal')} />
                        </div>
                        <div>
                          <div className="text-gray-500">成約目標単価（階効用込み）</div>
                          <div className="text-2xl font-semibold"><span className="num">{maxTarget ? fmtYen(maxTarget) + '/㎡' : '—'}</span></div>
                          <p className="text-xs text-gray-500 mt-1">※団地基本情報の階数効用比率を適用</p>
                        </div>
                      </div>
                    </form>
                  ) : null}

                  {entryKind === 'MINI' ? (
                    <form className="space-y-6" onSubmit={(ev) => { handleSubmit('MINI', ev).catch(console.error) }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">MINI</span>
                          <h3 className="font-semibold">過去MINI編集（最低成約価格を記録）</h3>
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-black text-white rounded-lg text-sm disabled:opacity-60" disabled={savingMini || !selectedComplex}>
                          {savingMini ? '更新中...' : '更新'}
                        </button>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <label className="block">階数<input type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="3" value={miniForm.floor} onChange={onMiniChange('floor')} /></label>
                        <label className="block">面積（㎡）<input type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="55.20" value={miniForm.area} onChange={onMiniChange('area')} /></label>
                        <label className="block">間取り<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="2LDK" value={miniForm.layout} onChange={onMiniChange('layout')} /></label>
                        <label className="block">登録年月日<input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={miniForm.reins} onChange={onMiniChange('reins')} /></label>
                        <label className="block">成約年月日<input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={miniForm.contract} onChange={onMiniChange('contract')} /></label>
                        <label className="block">成約価格（MINI）<input type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="7500000" value={miniForm.price} onChange={onMiniChange('price')} /></label>
                        <label className="block">リノベ有無
                          <select className="mt-1 w-full border rounded-lg px-3 py-2" value={miniForm.renovated} onChange={onMiniChange('renovated')}>
                            <option value="">選択</option><option value="有">有</option><option value="無">無</option>
                          </select>
                        </label>
                        <label className="block md:col-span-2">マイソク添付
                          <input type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => setMiniForm((prev) => ({ ...prev, pdf: e.target.files?.[0] ?? null }))} />
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
                      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 text-sm grid md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-gray-500">成約㎡単価</div>
                          <div className="text-2xl font-semibold"><span className="num">{miniUnit ? fmtYen(miniUnit) + '/㎡' : '—'}</span></div>
                        </div>
                        <div>
                          <div className="text-gray-500">係数（任意: 内装/年数適用する場合）</div>
                          <input type="number" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" value={miniForm.coef} onChange={onMiniChange('coef')} />
                        </div>
                        <div>
                          <div className="text-gray-500">目標単価（階効用込み）</div>
                          <div className="text-2xl font-semibold"><span className="num">{miniTarget ? fmtYen(miniTarget) + '/㎡' : '—'}</span></div>
                          <p className="text-xs text-gray-500 mt-1">※必要に応じ階数効用比率を適用</p>
                        </div>
                      </div>
                    </form>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
