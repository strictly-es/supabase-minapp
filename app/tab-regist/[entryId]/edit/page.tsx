'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type DealLabel = '' | 'MAX' | 'MINI'
type ElevatorChoice = 'あり' | 'なし' | 'スキップ'
type ConditionStatus =
  | ''
  | 'FULL_RENO_INSULATED'
  | 'FULL_RENO_HIGH_DESIGN'
  | 'FULL_REFORM_ALL_EQUIP'
  | 'PARTIAL_REFORM'
  | 'OWNER_OCCUPIED'
  | 'NEEDS_RENOVATION'
  | 'INVESTMENT_PROPERTY'

type ComplexOption = {
  id: string
  name: string
  pref: string | null
  city: string | null
  town: string | null
  stationName: string | null
  stationAccessType: string | null
  stationMinutes: number | null
  unitCount: number | null
}

type EntryRow = {
  id: string
  complex_id: string | null
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  contract_price: number | null
  built_month: string | null
  building_no: number | null
  condition_status: Exclude<ConditionStatus, ''> | null
  has_elevator: boolean | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  mysoku_pdf_path: string | null
}

type FormState = {
  elevator: ElevatorChoice
  builtYm: string
  buildingNo: string
  floor: string
  price: string
  area: string
  reinsDate: string
  contractDate: string
  status: ConditionStatus
  label: DealLabel
  pdf: File | null
}

const STATUS_OPTIONS: { value: Exclude<ConditionStatus, ''>; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

const westernDateFormatter = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
const warekiDateFormatter = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { era: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
const warekiMonthFormatter = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { era: 'short', year: 'numeric', month: 'long' })

const initialForm: FormState = {
  elevator: 'スキップ',
  builtYm: '',
  buildingNo: '',
  floor: '',
  price: '',
  area: '',
  reinsDate: '',
  contractDate: '',
  status: '',
  label: '',
  pdf: null,
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function toInt(v: string): number | null {
  if (!v.trim()) return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function toFloat(v: string): number | null {
  if (!v.trim()) return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function toDateInput(v: string | null): string {
  if (!v) return ''
  return v.includes('T') ? v.slice(0, 10) : v
}

function toMonthInput(v: string | null): string {
  if (!v) return ''
  const datePart = v.includes('T') ? v.slice(0, 10) : v
  return datePart.slice(0, 7)
}

function toDateOrNull(v: string): string | null {
  return v ? v : null
}

function monthToDateOrNull(v: string): string | null {
  return v ? `${v}-01` : null
}

function calcUnitPrice(price: string, area: string): number | null {
  const p = toFloat(price)
  const a = toFloat(area)
  if (p == null || a == null || a <= 0) return null
  return Math.round((p / a) * 100) / 100
}

function calcElapsedDays(reinsDate: string, contractDate: string): number | null {
  if (!reinsDate || !contractDate) return null
  const reins = new Date(`${reinsDate}T00:00:00`)
  const contract = new Date(`${contractDate}T00:00:00`)
  if (Number.isNaN(reins.getTime()) || Number.isNaN(contract.getTime())) return null
  return Math.round((contract.getTime() - reins.getTime()) / 86400000)
}

function formatDateWithEra(v: string): string {
  if (!v) return '—'
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return `${westernDateFormatter.format(d)} (${warekiDateFormatter.format(d)})`
}

function formatMonthWithEra(v: string): string {
  if (!v) return '—'
  const d = new Date(`${v}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  const [y, m] = v.split('-')
  return `${y}年${m}月 (${warekiMonthFormatter.format(d)})`
}

function elevatorToDb(v: ElevatorChoice): boolean | null {
  if (v === 'あり') return true
  if (v === 'なし') return false
  return null
}

function priceFromRow(row: EntryRow): number | null {
  if (typeof row.contract_price === 'number' && Number.isFinite(row.contract_price)) return row.contract_price
  if (typeof row.max_price === 'number' && Number.isFinite(row.max_price)) return row.max_price
  if (typeof row.past_min === 'number' && Number.isFinite(row.past_min)) return row.past_min
  return null
}

function buildLabelSpecificResetPayload(previousKind: EntryRow['contract_kind'], nextKind: DealLabel) {
  if (previousKind === nextKind) return {}
  if (nextKind === 'MAX') {
    return {
      renovated: null,
    }
  }
  if (nextKind === 'MINI') {
    return {
      coef_total: null,
      interior_level_coef: null,
      contract_year_coef: null,
    }
  }
  return {
    coef_total: null,
    interior_level_coef: null,
    contract_year_coef: null,
    renovated: null,
  }
}

export default function EntryEditPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ entryId: string }>()
  const entryId = params?.entryId as string | undefined

  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState('')
  const [originalContractKind, setOriginalContractKind] = useState<EntryRow['contract_kind']>(null)
  const [form, setForm] = useState<FormState>(initialForm)

  const [loadingComplexes, setLoadingComplexes] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [existingPdfPath, setExistingPdfPath] = useState<string | null>(null)
  const [existingPdfSignedUrl, setExistingPdfSignedUrl] = useState<string | null>(null)

  const selectedComplex = useMemo(
    () => complexes.find((complex) => complex.id === selectedComplexId) ?? null,
    [complexes, selectedComplexId],
  )

  const unitPrice = useMemo(() => calcUnitPrice(form.price, form.area), [form.price, form.area])
  const elapsedDays = useMemo(() => calcElapsedDays(form.reinsDate, form.contractDate), [form.reinsDate, form.contractDate])

  useEffect(() => {
    let mounted = true
    async function loadComplexes() {
      setLoadingComplexes(true)
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select('id, name, pref, city, town, station_name, station_access_type, station_minutes, unit_count')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        const list = (data ?? []).map((row) => ({
          id: row.id as string,
          name: (row.name as string | null) ?? '(名称未設定)',
          pref: (row.pref as string | null) ?? null,
          city: (row.city as string | null) ?? null,
          town: (row.town as string | null) ?? null,
          stationName: (row.station_name as string | null) ?? null,
          stationAccessType: (row.station_access_type as string | null) ?? null,
          stationMinutes: (row.station_minutes as number | null) ?? null,
          unitCount: (row.unit_count as number | null) ?? null,
        }))
        if (mounted) setComplexes(list)
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingComplexes(false)
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    async function loadEntry() {
      if (!entryId) {
        setLoadingEntry(false)
        setMsg('成約データが見つかりません')
        return
      }
      setLoadingEntry(true)
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, complex_id, contract_kind, floor, area_sqm, contract_price, built_month, building_no, condition_status, has_elevator, reins_registered_date, contract_date, max_price, past_min, mysoku_pdf_path')
          .eq('id', entryId)
          .maybeSingle()
        if (error) throw error
        const row = (data ?? null) as EntryRow | null
        if (!row) {
          if (mounted) setMsg('成約データが見つかりません')
          return
        }

        if (mounted) {
          setSelectedComplexId(row.complex_id ?? '')
          setOriginalContractKind(row.contract_kind ?? null)
          setExistingPdfPath(row.mysoku_pdf_path ?? null)
          setForm({
            elevator: row.has_elevator === true ? 'あり' : row.has_elevator === false ? 'なし' : 'スキップ',
            builtYm: toMonthInput(row.built_month),
            buildingNo: typeof row.building_no === 'number' ? String(row.building_no) : '',
            floor: typeof row.floor === 'number' ? String(row.floor) : '',
            price: (() => {
              const p = priceFromRow(row)
              return typeof p === 'number' ? String(p) : ''
            })(),
            area: typeof row.area_sqm === 'number' ? String(row.area_sqm) : '',
            reinsDate: toDateInput(row.reins_registered_date),
            contractDate: toDateInput(row.contract_date),
            status: (row.condition_status ?? '') as ConditionStatus,
            label: row.contract_kind ?? '',
            pdf: null,
          })
        }

        if (row.mysoku_pdf_path) {
          try {
            const { data: signedData } = await supabase.storage.from('uploads').createSignedUrl(row.mysoku_pdf_path, 600)
            if (mounted) setExistingPdfSignedUrl(signedData?.signedUrl ?? null)
          } catch {
            if (mounted) setExistingPdfSignedUrl(null)
          }
        }
      } catch (e) {
        console.error('[entry:load]', e)
        if (mounted) setMsg('成約データの取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingEntry(false)
      }
    }
    loadEntry()
    return () => { mounted = false }
  }, [supabase, entryId])

  function onChange<K extends Exclude<keyof FormState, 'pdf'>>(key: K) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value
      if (key === 'label') {
        const label = value as DealLabel
        setForm((prev) => ({ ...prev, label, pdf: label ? prev.pdf : null }))
        return
      }
      if (key === 'status') {
        setForm((prev) => ({ ...prev, status: value as ConditionStatus }))
        return
      }
      if (key === 'elevator') {
        setForm((prev) => ({ ...prev, elevator: value as ElevatorChoice }))
        return
      }
      setForm((prev) => ({ ...prev, [key]: value }))
    }
  }

  async function uploadPdf(file: File, userId: string, label: DealLabel): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const path = `${userId}/mysoku/${Date.now()}-${label || 'NONE'}-${safeName}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, {
      upsert: false,
      contentType: 'application/pdf',
    })
    if (error) throw new Error('PDFアップロード失敗: ' + error.message)
    return path
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!entryId) return
    if (!selectedComplex) {
      setMsg('団地を選択してください')
      return
    }
    if (form.pdf && !form.label) {
      setMsg('PDF添付はMAX/MINIラベルが付いた場合のみ可能です')
      return
    }

    setSaving(true)
    setMsg('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error('ログインが必要です')

      if (form.label) {
        const { data: conflictRows, error: conflictError } = await supabase
          .from('estate_entries')
          .select('id')
          .eq('complex_id', selectedComplexId)
          .eq('contract_kind', form.label)
          .neq('id', entryId)
          .is('deleted_at', null)
          .limit(1)
        if (conflictError) throw conflictError
        if ((conflictRows ?? []).length > 0) {
          setMsg(`${form.label}ラベルは同じ団地内で1件のみ指定できます`)
          setSaving(false)
          return
        }
      }

      let pdfPath = form.label ? existingPdfPath : null
      if (form.pdf) {
        pdfPath = await uploadPdf(form.pdf, user.id, form.label)
      }

      const price = toInt(form.price)
      const kind = form.label || null
      const payload = {
        estate_name: selectedComplex.name,
        complex_id: selectedComplex.id,
        has_elevator: elevatorToDb(form.elevator),
        built_month: monthToDateOrNull(form.builtYm),
        building_no: toInt(form.buildingNo),
        floor: toInt(form.floor),
        contract_price: price,
        max_price: kind === 'MAX' ? price : null,
        past_min: kind === 'MINI' ? price : null,
        area_sqm: toFloat(form.area),
        unit_price: calcUnitPrice(form.price, form.area),
        reins_registered_date: toDateOrNull(form.reinsDate),
        contract_date: toDateOrNull(form.contractDate),
        condition_status: form.status || null,
        contract_kind: kind,
        mysoku_pdf_path: pdfPath,
        ...buildLabelSpecificResetPayload(originalContractKind, form.label),
      }

      const { error } = await supabase
        .from('estate_entries')
        .update(payload)
        .eq('id', entryId)
      if (error) throw error

      setExistingPdfPath(pdfPath)
      setExistingPdfSignedUrl(null)
      setOriginalContractKind(kind)
      setMsg('更新しました')
      router.push(`/tab-list?complexId=${encodeURIComponent(selectedComplex.id)}`)
    } catch (e) {
      console.error('[entry:update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const complexLocation = useMemo(() => {
    if (!selectedComplex) return '—'
    return [selectedComplex.pref ?? '', selectedComplex.city ?? '', selectedComplex.town ?? ''].filter(Boolean).join(' ') || '—'
  }, [selectedComplex])

  const complexStation = useMemo(() => selectedComplex?.stationName ?? '—', [selectedComplex])
  const complexStationWalk = useMemo(() => {
    if (!selectedComplex || selectedComplex.stationMinutes == null) return '—'
    return `${selectedComplex.stationAccessType ?? '徒歩'}${selectedComplex.stationMinutes}分`
  }, [selectedComplex])

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <h1 className="text-lg font-semibold">過去成約編集（1成約1行）</h1>
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
              <li><Link href="/tab-complex" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地基本情報</Link></li>
              <li><Link href="/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約登録</Link></li>
              <li><Link href="/tab-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約一覧</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">編集</span></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="bg-white rounded-2xl shadow p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">過去成約編集</h2>
              <Link href={selectedComplexId ? `/tab-list?complexId=${encodeURIComponent(selectedComplexId)}` : '/tab-list'} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                一覧へ戻る
              </Link>
            </div>

            {msg && (
              <p className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                {msg}
              </p>
            )}

            {loadingEntry ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <label className="block">対象団地
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={selectedComplexId}
                      onChange={(e) => setSelectedComplexId(e.target.value)}
                      disabled={loadingComplexes}
                    >
                      {complexes.map((complex) => (
                        <option key={complex.id} value={complex.id}>
                          {complex.name} {complex.pref ?? ''}{complex.city ? ` ${complex.city}` : ''}
                        </option>
                      ))}
                      {complexes.length === 0 && <option value="">団地なし</option>}
                    </select>
                  </label>
                </div>

                <div className="grid md:grid-cols-5 gap-3 text-sm">
                  <div className="rounded-lg border p-3 bg-gray-50"><div className="text-gray-500 text-xs">1 団地名</div><div className="font-semibold">{selectedComplex?.name ?? '—'}</div></div>
                  <div className="rounded-lg border p-3 bg-gray-50"><div className="text-gray-500 text-xs">2 所在地</div><div>{complexLocation}</div></div>
                  <div className="rounded-lg border p-3 bg-gray-50"><div className="text-gray-500 text-xs">3 最寄り駅</div><div>{complexStation}</div></div>
                  <div className="rounded-lg border p-3 bg-gray-50"><div className="text-gray-500 text-xs">4 徒歩時間</div><div>{complexStationWalk}</div></div>
                  <div className="rounded-lg border p-3 bg-gray-50"><div className="text-gray-500 text-xs">5 総戸数</div><div>{selectedComplex?.unitCount != null ? `${selectedComplex.unitCount}戸` : '—'}</div></div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block">ラベル
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.label} onChange={onChange('label')}>
                      <option value="">なし</option>
                      <option value="MAX">MAX</option>
                      <option value="MINI">MINI</option>
                    </select>
                  </label>
                  <label className="block">6 エレベーター
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.elevator} onChange={onChange('elevator')}>
                      <option value="あり">あり</option>
                      <option value="なし">なし</option>
                      <option value="スキップ">スキップ</option>
                    </select>
                  </label>
                  <label className="block">7 築年月
                    <input type="month" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.builtYm} onChange={onChange('builtYm')} />
                    <p className="text-[11px] text-gray-500 mt-1">{formatMonthWithEra(form.builtYm)}</p>
                  </label>
                  <label className="block">8 棟番号
                    <input type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.buildingNo} onChange={onChange('buildingNo')} />
                  </label>
                  <label className="block">9 階数
                    <input type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.floor} onChange={onChange('floor')} />
                  </label>
                  <label className="block">10 成約価格
                    <input type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.price} onChange={onChange('price')} />
                  </label>
                  <label className="block">11 ㎡数
                    <input type="number" min={0} step={0.01} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.area} onChange={onChange('area')} />
                  </label>
                  <div className="block">12 ㎡単価
                    <div className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-600">
                      {unitPrice == null ? '—' : `${unitPrice.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}円/㎡`}
                    </div>
                  </div>
                  <label className="block">13 レインズ登録年月日
                    <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.reinsDate} onChange={onChange('reinsDate')} />
                    <p className="text-[11px] text-gray-500 mt-1">{formatDateWithEra(form.reinsDate)}</p>
                  </label>
                  <label className="block">14 レインズ成約年月日
                    <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.contractDate} onChange={onChange('contractDate')} />
                    <p className="text-[11px] text-gray-500 mt-1">{formatDateWithEra(form.contractDate)}</p>
                  </label>
                  <div className="block">15 経過日数
                    <div className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-600">{elapsedDays == null ? '—' : `${elapsedDays}日`}</div>
                  </div>
                  <label className="block md:col-span-2">16 状態
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.status} onChange={onChange('status')}>
                      <option value="">選択</option>
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-3 space-y-2">
                    <div className="text-sm font-medium">PDF（MAX/MINIのみ）</div>
                    {existingPdfPath && (
                      <div className="text-xs text-gray-600">
                        登録済みPDFあり
                        {existingPdfSignedUrl && (
                          <a className="ml-2 underline text-blue-700" href={existingPdfSignedUrl} target="_blank" rel="noopener noreferrer">確認</a>
                        )}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={!form.label}
                      className="w-full border rounded-lg px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                      onChange={(e) => setForm((prev) => ({ ...prev, pdf: e.target.files?.[0] ?? null }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg text-sm disabled:opacity-60" disabled={saving || !selectedComplex}>
                    {saving ? '更新中...' : '更新'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
