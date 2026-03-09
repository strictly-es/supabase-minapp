'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type SortKey = 'contract_price' | 'contract_date' | 'condition_status' | 'floor'
type SortDirection = 'asc' | 'desc'
type LabelFilter = 'all' | 'MAX' | 'MINI' | 'none'
type ConditionStatus =
  | 'FULL_RENO_INSULATED'
  | 'FULL_RENO_HIGH_DESIGN'
  | 'FULL_REFORM_ALL_EQUIP'
  | 'PARTIAL_REFORM'
  | 'OWNER_OCCUPIED'
  | 'NEEDS_RENOVATION'
  | 'INVESTMENT_PROPERTY'
  | null

type DealLabel = '' | 'MAX' | 'MINI'
type ElevatorChoice = 'あり' | 'なし' | 'スキップ'

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
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  contract_price: number | null
  unit_price: number | null
  built_month: string | null
  building_no: number | null
  condition_status: ConditionStatus
  has_elevator: boolean | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  mysoku_pdf_path: string | null
  created_at: string
}

type EntryDraft = {
  contract_kind: DealLabel
  has_elevator: ElevatorChoice
  built_month: string
  building_no: string
  floor: string
  contract_price: string
  area_sqm: string
  reins_registered_date: string
  contract_date: string
  condition_status: ConditionStatus | ''
}

const STATUS_LABELS: Record<Exclude<ConditionStatus, null>, string> = {
  FULL_RENO_INSULATED: 'フルリノベーション+断熱',
  FULL_RENO_HIGH_DESIGN: 'フルリノベーション(デザイン性・快適性良好)',
  FULL_REFORM_ALL_EQUIP: 'フルリフォーム(設備全て交換)',
  PARTIAL_REFORM: '一部リフォーム',
  OWNER_OCCUPIED: '売主居住中',
  NEEDS_RENOVATION: '改修必要',
  INVESTMENT_PROPERTY: '収益物件',
}

const STATUS_OPTIONS: { value: Exclude<ConditionStatus, null>; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function effectivePrice(row: EntryRow): number | null {
  if (typeof row.contract_price === 'number' && Number.isFinite(row.contract_price)) return row.contract_price
  if (typeof row.max_price === 'number' && Number.isFinite(row.max_price)) return row.max_price
  if (typeof row.past_min === 'number' && Number.isFinite(row.past_min)) return row.past_min
  return null
}

function toInt(value: string): number | null {
  if (!value.trim()) return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function toFloat(value: string): number | null {
  if (!value.trim()) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.includes('T') ? value.slice(0, 10) : value
}

function toMonthInput(value: string | null): string {
  if (!value) return ''
  const datePart = value.includes('T') ? value.slice(0, 10) : value
  return datePart.slice(0, 7)
}

function toDateOrNull(value: string): string | null {
  return value ? value : null
}

function monthToDateOrNull(value: string): string | null {
  return value ? `${value}-01` : null
}

function elevatorToDb(value: ElevatorChoice): boolean | null {
  if (value === 'あり') return true
  if (value === 'なし') return false
  return null
}

function calcUnitPrice(price: string, area: string): number | null {
  const p = toFloat(price)
  const a = toFloat(area)
  if (p == null || a == null || a <= 0) return null
  return Math.round((p / a) * 100) / 100
}

function effectiveUnitPrice(row: EntryRow): number | null {
  if (typeof row.unit_price === 'number' && Number.isFinite(row.unit_price)) return row.unit_price
  const price = effectivePrice(row)
  if (price == null || typeof row.area_sqm !== 'number' || row.area_sqm <= 0) return null
  return Math.round((price / row.area_sqm) * 100) / 100
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function diffDays(a: string | null, b: string | null): number | null {
  const da = parseDate(a)
  const db = parseDate(b)
  if (!da || !db) return null
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function formatUnit(value: number | null): string {
  if (value == null) return '—'
  return `${value.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}円/㎡`
}

function statusLabel(value: ConditionStatus): string {
  if (!value) return '—'
  return STATUS_LABELS[value] ?? '—'
}

function rowToDraft(row: EntryRow): EntryDraft {
  return {
    contract_kind: row.contract_kind ?? '',
    has_elevator: row.has_elevator === true ? 'あり' : row.has_elevator === false ? 'なし' : 'スキップ',
    built_month: toMonthInput(row.built_month),
    building_no: typeof row.building_no === 'number' ? String(row.building_no) : '',
    floor: typeof row.floor === 'number' ? String(row.floor) : '',
    contract_price: (() => {
      const price = effectivePrice(row)
      return typeof price === 'number' ? String(price) : ''
    })(),
    area_sqm: typeof row.area_sqm === 'number' ? String(row.area_sqm) : '',
    reins_registered_date: toDateInput(row.reins_registered_date),
    contract_date: toDateInput(row.contract_date),
    condition_status: row.condition_status ?? '',
  }
}

function draftEqualsRow(draft: EntryDraft, row: EntryRow): boolean {
  const current = rowToDraft(row)
  return JSON.stringify(draft) === JSON.stringify(current)
}

function applyDraft(row: EntryRow, draft: EntryDraft | undefined): EntryRow {
  if (!draft) return row
  const price = toInt(draft.contract_price)
  const label = draft.contract_kind || null
  return {
    ...row,
    contract_kind: label,
    has_elevator: elevatorToDb(draft.has_elevator),
    built_month: monthToDateOrNull(draft.built_month),
    building_no: toInt(draft.building_no),
    floor: toInt(draft.floor),
    contract_price: price,
    max_price: label === 'MAX' ? price : null,
    past_min: label === 'MINI' ? price : null,
    area_sqm: toFloat(draft.area_sqm),
    unit_price: calcUnitPrice(draft.contract_price, draft.area_sqm),
    reins_registered_date: toDateOrNull(draft.reins_registered_date),
    contract_date: toDateOrNull(draft.contract_date),
    condition_status: draft.condition_status || null,
  }
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

export default function TabListClient() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()

  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState('')
  const [loadingComplexes, setLoadingComplexes] = useState(false)

  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [msg, setMsg] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('contract_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')

  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [reloadKey, setReloadKey] = useState(0)

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
        if (!mounted) return
        setComplexes(list)
        const requested = searchParams?.get('complexId') ?? ''
        setSelectedComplexId((prev) => {
          if (requested && list.some((item) => item.id === requested)) return requested
          if (prev && list.some((item) => item.id === prev)) return prev
          return list[0]?.id ?? ''
        })
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingComplexes(false)
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase, searchParams])

  useEffect(() => {
    if (!selectedComplexId) return
    let mounted = true
    async function loadEntries() {
      setLoadingEntries(true)
      setMsg('')
      try {
        const nextSelect = 'id, contract_kind, floor, area_sqm, contract_price, unit_price, built_month, building_no, condition_status, has_elevator, reins_registered_date, contract_date, max_price, past_min, mysoku_pdf_path, created_at'
        const legacySelect = 'id, contract_kind, floor, area_sqm, has_elevator, reins_registered_date, contract_date, max_price, past_min, mysoku_pdf_path, created_at'

        const { data, error } = await supabase
          .from('estate_entries')
          .select(nextSelect)
          .eq('complex_id', selectedComplexId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5000)

        if (error) {
          const maybeMissingColumn = /column .* does not exist/i.test(error.message)
          if (!maybeMissingColumn) throw error

          const { data: legacyData, error: legacyError } = await supabase
            .from('estate_entries')
            .select(legacySelect)
            .eq('complex_id', selectedComplexId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5000)
          if (legacyError) throw legacyError

          const mapped = (legacyData ?? []).map((row) => ({
            ...(row as Omit<EntryRow, 'contract_price' | 'unit_price' | 'built_month' | 'building_no' | 'condition_status'>),
            contract_price: null,
            unit_price: null,
            built_month: null,
            building_no: null,
            condition_status: null,
          })) as EntryRow[]
          if (mounted) {
            setEntries(mapped)
            setDrafts({})
          }
          return
        }

        if (mounted) {
          setEntries((data ?? []) as EntryRow[])
          setDrafts({})
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('成約一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingEntries(false)
      }
    }
    loadEntries()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, reloadKey])

  const selectedComplex = useMemo(
    () => complexes.find((complex) => complex.id === selectedComplexId) ?? null,
    [complexes, selectedComplexId],
  )

  const displayEntries = useMemo(
    () => entries.map((row) => applyDraft(row, drafts[row.id])),
    [drafts, entries],
  )

  const filteredAndSorted = useMemo(() => {
    const filtered = displayEntries.filter((row) => {
      if (labelFilter === 'all') return true
      if (labelFilter === 'none') return row.contract_kind == null
      return row.contract_kind === labelFilter
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'contract_price') {
        const av = effectivePrice(a) ?? Number.NEGATIVE_INFINITY
        const bv = effectivePrice(b) ?? Number.NEGATIVE_INFINITY
        return av - bv
      }
      if (sortKey === 'contract_date') {
        const av = parseDate(a.contract_date)?.getTime() ?? Number.NEGATIVE_INFINITY
        const bv = parseDate(b.contract_date)?.getTime() ?? Number.NEGATIVE_INFINITY
        return av - bv
      }
      if (sortKey === 'condition_status') {
        return statusLabel(a.condition_status).localeCompare(statusLabel(b.condition_status), 'ja')
      }
      const av = typeof a.floor === 'number' ? a.floor : Number.NEGATIVE_INFINITY
      const bv = typeof b.floor === 'number' ? b.floor : Number.NEGATIVE_INFINITY
      return av - bv
    })

    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [displayEntries, labelFilter, sortKey, sortDirection])

  const headerMsg = useMemo(() => {
    if (loadingComplexes || loadingEntries) return '読み込み中...'
    if (msg) return msg
    return `全${filteredAndSorted.length}件`
  }, [loadingComplexes, loadingEntries, msg, filteredAndSorted.length])

  async function handleDelete(entryId: string) {
    const ok = window.confirm('この過去成約を削除しますか？')
    if (!ok) return
    setDeletingId(entryId); setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) throw new Error('ログインが必要です')
      const payload: { deleted_at: string; deleted_by?: string } = { deleted_at: new Date().toISOString() }
      if (user.id) payload.deleted_by = user.id
      const { error } = await supabase
        .from('estate_entries')
        .update(payload)
        .eq('id', entryId)
      if (error) throw error
      setMsg('削除しました')
      setReloadKey((k) => k + 1)
    } catch (e) {
      console.error('[entries:delete]', e)
      setMsg('削除に失敗しました: ' + toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  function handleDraftChange(entryId: string, key: keyof EntryDraft) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value
      setDrafts((prev) => {
        const row = entries.find((item) => item.id === entryId)
        if (!row) return prev
        const next = { ...(prev[entryId] ?? rowToDraft(row)), [key]: value } as EntryDraft
        return { ...prev, [entryId]: next }
      })
    }
  }

  function handleResetDraft(entryId: string) {
    setDrafts((prev) => {
      if (!(entryId in prev)) return prev
      const next = { ...prev }
      delete next[entryId]
      return next
    })
  }

  async function handleSave(entryId: string) {
    const original = entries.find((row) => row.id === entryId)
    const draft = drafts[entryId]
    if (!original || !draft || !selectedComplex) return
    if (draftEqualsRow(draft, original)) {
      handleResetDraft(entryId)
      return
    }

    setSavingId(entryId)
    setMsg('')
    try {
      if (draft.contract_kind) {
        const { data: conflictRows, error: conflictError } = await supabase
          .from('estate_entries')
          .select('id')
          .eq('complex_id', selectedComplex.id)
          .eq('contract_kind', draft.contract_kind)
          .neq('id', entryId)
          .is('deleted_at', null)
          .limit(1)
        if (conflictError) throw conflictError
        if ((conflictRows ?? []).length > 0) {
          setMsg(`${draft.contract_kind}ラベルは同じ団地内で1件のみ指定できます`)
          return
        }
      }

      const price = toInt(draft.contract_price)
      const label = draft.contract_kind || null
      const nextRow = applyDraft(original, draft)
      const payload = {
        estate_name: selectedComplex.name,
        complex_id: selectedComplex.id,
        has_elevator: elevatorToDb(draft.has_elevator),
        built_month: monthToDateOrNull(draft.built_month),
        building_no: toInt(draft.building_no),
        floor: toInt(draft.floor),
        contract_price: price,
        max_price: label === 'MAX' ? price : null,
        past_min: label === 'MINI' ? price : null,
        area_sqm: toFloat(draft.area_sqm),
        unit_price: calcUnitPrice(draft.contract_price, draft.area_sqm),
        reins_registered_date: toDateOrNull(draft.reins_registered_date),
        contract_date: toDateOrNull(draft.contract_date),
        condition_status: draft.condition_status || null,
        contract_kind: label,
        ...buildLabelSpecificResetPayload(original.contract_kind, draft.contract_kind),
      }

      const { error } = await supabase.from('estate_entries').update(payload).eq('id', entryId)
      if (error) throw error

      setEntries((prev) => prev.map((row) => (row.id === entryId ? nextRow : row)))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[entryId]
        return next
      })
      setMsg('更新しました')
    } catch (e) {
      console.error('[entries:update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSavingId(null)
    }
  }

  async function handleOpenPdf(entryId: string, path: string | null) {
    if (!path) return
    setOpeningPdfId(entryId)
    try {
      const { data, error } = await supabase
        .storage
        .from('uploads')
        .createSignedUrl(path, 600)
      if (error) throw error
      if (!data?.signedUrl) throw new Error('PDF URLの生成に失敗しました')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('[entries:pdf]', e)
      setMsg('PDF表示に失敗しました: ' + toErrorMessage(e))
    } finally {
      setOpeningPdfId(null)
    }
  }

  const locationText = useMemo(() => {
    if (!selectedComplex) return '—'
    return [selectedComplex.pref ?? '', selectedComplex.city ?? '', selectedComplex.town ?? ''].filter(Boolean).join(' ') || '—'
  }, [selectedComplex])

  const stationText = useMemo(() => selectedComplex?.stationName ?? '—', [selectedComplex])
  const stationWalkText = useMemo(() => {
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
              <div>
                <h1 className="text-lg font-semibold">過去成約一覧（団地別）</h1>
                <p className="text-xs text-gray-500">1成約1行で全件を表示・並び替え</p>
              </div>
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
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">過去成約一覧</span></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-sm text-gray-500">対象団地</div>
                  <div className="text-xl font-semibold">{selectedComplex?.name ?? '団地未選択'}</div>
                  <div className="text-xs text-gray-500">{locationText} / 最寄: {stationText} / {stationWalkText}</div>
                </div>
                <span className="flex-1" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">団地
                    <select
                      className="border rounded-lg px-2 py-1"
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
                  <label className="flex items-center gap-1">ラベル
                    <select className="border rounded-lg px-2 py-1" value={labelFilter} onChange={(e) => setLabelFilter(e.target.value as LabelFilter)}>
                      <option value="all">すべて</option>
                      <option value="MAX">MAX</option>
                      <option value="MINI">MINI</option>
                      <option value="none">ラベルなし</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">並び替え
                    <select className="border rounded-lg px-2 py-1" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                      <option value="contract_price">成約価格</option>
                      <option value="contract_date">成約年月日</option>
                      <option value="condition_status">状態</option>
                      <option value="floor">階数</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">順序
                    <select className="border rounded-lg px-2 py-1" value={sortDirection} onChange={(e) => setSortDirection(e.target.value as SortDirection)}>
                      <option value="desc">降順</option>
                      <option value="asc">昇順</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="text-sm text-gray-500">{headerMsg}</div>

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
                            <select className="w-20 border rounded px-2 py-1 bg-white" value={draft.contract_kind} onChange={handleDraftChange(row.id, 'contract_kind')}>
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
                            <select className="w-24 border rounded px-2 py-1 bg-white" value={draft.has_elevator} onChange={handleDraftChange(row.id, 'has_elevator')}>
                              <option value="あり">あり</option>
                              <option value="なし">なし</option>
                              <option value="スキップ">スキップ</option>
                            </select>
                          </td>
                          <td className="p-2"><input type="month" className="w-36 border rounded px-2 py-1 bg-white" value={draft.built_month} onChange={handleDraftChange(row.id, 'built_month')} /></td>
                          <td className="p-2"><input type="number" min={0} step={1} className="w-20 border rounded px-2 py-1 bg-white" value={draft.building_no} onChange={handleDraftChange(row.id, 'building_no')} /></td>
                          <td className="p-2"><input type="number" min={0} step={1} className="w-20 border rounded px-2 py-1 bg-white" value={draft.floor} onChange={handleDraftChange(row.id, 'floor')} /></td>
                          <td className="p-2"><input type="number" min={0} step={1} className="w-32 border rounded px-2 py-1 bg-white" value={draft.contract_price} onChange={handleDraftChange(row.id, 'contract_price')} /></td>
                          <td className="p-2"><input type="number" min={0} step={0.01} className="w-28 border rounded px-2 py-1 bg-white" value={draft.area_sqm} onChange={handleDraftChange(row.id, 'area_sqm')} /></td>
                          <td className="p-2">{formatUnit(unitPrice)}</td>
                          <td className="p-2"><input type="date" className="w-40 border rounded px-2 py-1 bg-white" value={draft.reins_registered_date} onChange={handleDraftChange(row.id, 'reins_registered_date')} /></td>
                          <td className="p-2"><input type="date" className="w-40 border rounded px-2 py-1 bg-white" value={draft.contract_date} onChange={handleDraftChange(row.id, 'contract_date')} /></td>
                          <td className="p-2">{elapsedDays == null ? '—' : `${elapsedDays}日`}</td>
                          <td className="p-2">
                            <select className="w-56 border rounded px-2 py-1 bg-white" value={draft.condition_status} onChange={handleDraftChange(row.id, 'condition_status')}>
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
                                onClick={() => { handleOpenPdf(row.id, row.mysoku_pdf_path).catch(console.error) }}
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
                              onClick={() => { handleSave(row.id).catch(console.error) }}
                              disabled={!isDirty || savingId === row.id}
                            >
                              {savingId === row.id ? '保存中...' : '保存'}
                            </button>
                            <button
                              type="button"
                              className="underline text-gray-600 mr-2 disabled:opacity-50"
                              onClick={() => handleResetDraft(row.id)}
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
                              onClick={() => { handleDelete(row.id).catch(console.error) }}
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

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link className="underline text-blue-700" href="/tab-regist">過去成約を追加</Link>
                <Link className="underline text-blue-700" href={`/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}`}>在庫一覧へ</Link>
                <Link className="underline text-blue-700" href="/tab-stock-reg">在庫登録へ</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
