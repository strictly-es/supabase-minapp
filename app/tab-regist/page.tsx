'use client'

import { Suspense, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  calcElapsedDays,
  calcUnitPriceFromStrings,
  elevatorChoiceToDb,
  formatUnitPrice,
  monthToDateOrNull,
  toDateOrNull,
  toFloatOrNull,
  toIntOrNull,
} from '@/lib/entryMath'
import { insertEntries, uploadEntryPdf } from '@/lib/repositories/entries'
import { listTabListComplexes } from '@/lib/repositories/tabList'
import { getSupabase } from '@/lib/supabaseClient'
import { useClientSearchParams } from '@/lib/useClientSearchParams'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type DealLabel = '' | 'MAX' | 'MINI'
type ElevatorChoice = 'あり' | 'なし' | 'スキップ'
type SortKey = 'input_order' | 'price' | 'contract_date' | 'status' | 'floor'
type SortDirection = 'asc' | 'desc'

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

type DealRow = {
  id: string
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

type EditableRowField = Exclude<keyof DealRow, 'id' | 'pdf'>

const STATUS_OPTIONS: { value: Exclude<ConditionStatus, ''>; label: string }[] = [
  { value: 'FULL_RENO_INSULATED', label: 'フルリノベーション+断熱' },
  { value: 'FULL_RENO_HIGH_DESIGN', label: 'フルリノベーション(デザイン性・快適性良好)' },
  { value: 'FULL_REFORM_ALL_EQUIP', label: 'フルリフォーム(設備全て交換)' },
  { value: 'PARTIAL_REFORM', label: '一部リフォーム' },
  { value: 'OWNER_OCCUPIED', label: '売主居住中（または居住可能な状態）' },
  { value: 'NEEDS_RENOVATION', label: '改修必要' },
  { value: 'INVESTMENT_PROPERTY', label: '収益物件' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'input_order', label: '入力順' },
  { value: 'price', label: '成約価格' },
  { value: 'contract_date', label: '成約年月日' },
  { value: 'status', label: '状態' },
  { value: 'floor', label: '階数' },
]

const westernDateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const warekiDateFormatter = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
  era: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const warekiMonthFormatter = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
  era: 'short',
  year: 'numeric',
  month: 'long',
})

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function buildEmptyRow(seed: number): DealRow {
  return {
    id: String(seed),
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

function formatYen(v: number | null): string {
  if (v == null) return '—'
  return `${Math.round(v).toLocaleString('ja-JP')}円`
}

function isRowFilled(row: DealRow): boolean {
  return Boolean(
    row.builtYm ||
    row.buildingNo ||
    row.floor ||
    row.price ||
    row.area ||
    row.reinsDate ||
    row.contractDate ||
    row.status ||
    row.label ||
    row.pdf ||
    row.elevator !== 'スキップ'
  )
}

function statusLabel(v: ConditionStatus): string {
  if (!v) return ''
  return STATUS_OPTIONS.find((x) => x.value === v)?.label ?? ''
}

function compareRows(a: DealRow, b: DealRow, key: SortKey): number {
  if (key === 'price') {
    const av = toFloatOrNull(a.price) ?? Number.NEGATIVE_INFINITY
    const bv = toFloatOrNull(b.price) ?? Number.NEGATIVE_INFINITY
    return av - bv
  }
  if (key === 'contract_date') {
    const av = a.contractDate ? new Date(`${a.contractDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
    const bv = b.contractDate ? new Date(`${b.contractDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
    return av - bv
  }
  if (key === 'status') {
    return statusLabel(a.status).localeCompare(statusLabel(b.status), 'ja')
  }
  if (key === 'floor') {
    const av = toIntOrNull(a.floor) ?? Number.NEGATIVE_INFINITY
    const bv = toIntOrNull(b.floor) ?? Number.NEGATIVE_INFINITY
    return av - bv
  }
  return Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10)
}

function TabRegistPageContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useClientSearchParams()

  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState('')
  const [loadingComplexes, setLoadingComplexes] = useState(false)

  const [rows, setRows] = useState<DealRow[]>([buildEmptyRow(1)])
  const [sortKey, setSortKey] = useState<SortKey>('input_order')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const selectedComplex = useMemo(
    () => complexes.find((c) => c.id === selectedComplexId) ?? null,
    [complexes, selectedComplexId],
  )

  const sortedRows = useMemo(() => {
    if (sortKey === 'input_order') return rows
    const cloned = [...rows].sort((a, b) => compareRows(a, b, sortKey))
    return sortDirection === 'asc' ? cloned : cloned.reverse()
  }, [rows, sortKey, sortDirection])

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoadingComplexes(true)
      try {
        const list = await listTabListComplexes(supabase)
        if (!mounted) return
        setComplexes(list)

        const requestedId = searchParams?.get('complexId') ?? ''
        setSelectedComplexId((prev) => {
          if (requestedId && list.some((x) => x.id === requestedId)) return requestedId
          if (prev && list.some((x) => x.id === prev)) return prev
          return list[0]?.id ?? ''
        })
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingComplexes(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, searchParams])

  function updateRowField(rowId: string, field: EditableRowField, value: string) {
    setRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row
      if (field === 'label') {
        const label = value as DealLabel
        return { ...row, label, pdf: label ? row.pdf : null }
      }
      if (field === 'status') {
        return { ...row, status: value as ConditionStatus }
      }
      if (field === 'elevator') {
        return { ...row, elevator: value as ElevatorChoice }
      }
      return { ...row, [field]: value }
    }))
  }

  function updateRowPdf(rowId: string, file: File | null) {
    setRows((prev) => prev.map((row) => row.id === rowId ? { ...row, pdf: file } : row))
  }

  function removeRow(rowId: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.id !== rowId)
    })
  }

  function addRow() {
    setRows((prev) => {
      const maxId = prev.reduce((currentMax, row) => {
        const id = Number.parseInt(row.id, 10)
        return Number.isFinite(id) ? Math.max(currentMax, id) : currentMax
      }, 0)
      return [...prev, buildEmptyRow(maxId + 1)]
    })
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setMsg('')
    if (!selectedComplex) {
      setMsg('団地を選択してください')
      return
    }

    const activeRows = rows.filter(isRowFilled)
    if (activeRows.length === 0) {
      setMsg('入力された成約がありません')
      return
    }

    const maxRows = activeRows.filter((row) => row.label === 'MAX')
    const miniRows = activeRows.filter((row) => row.label === 'MINI')
    if (maxRows.length > 1 || miniRows.length > 1) {
      setMsg('MAXラベルとMINIラベルはそれぞれ1件のみ指定できます')
      return
    }

    for (const row of activeRows) {
      if (row.pdf && row.label === '') {
        setMsg('PDF添付はMAX/MINIラベルが付いた行のみ可能です')
        return
      }
      if (row.area && toFloatOrNull(row.area) == null) {
        setMsg('㎡数は数値で入力してください')
        return
      }
      if (row.price && toIntOrNull(row.price) == null) {
        setMsg('成約価格は整数で入力してください')
        return
      }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      setMsg('認証エラー: ' + authError.message)
      return
    }
    if (!user) {
      setMsg('ログインが必要です')
      return
    }

    try {
      setSaving(true)
      const payloads: Record<string, unknown>[] = []

      for (const row of activeRows) {
        const pdfPath = await uploadEntryPdf(supabase, row.pdf, user.id, row.id, row.label)
        const price = toIntOrNull(row.price)
        const unitPrice = calcUnitPriceFromStrings(row.price, row.area)
        const kind = row.label || null

        payloads.push({
          created_by: user.id,
          estate_name: selectedComplex.name,
          complex_id: selectedComplex.id,
          has_elevator: elevatorChoiceToDb(row.elevator),
          built_month: monthToDateOrNull(row.builtYm),
          building_no: toIntOrNull(row.buildingNo),
          floor: toIntOrNull(row.floor),
          contract_price: price,
          max_price: kind === 'MAX' ? price : null,
          past_min: kind === 'MINI' ? price : null,
          area_sqm: toFloatOrNull(row.area),
          unit_price: unitPrice,
          reins_registered_date: toDateOrNull(row.reinsDate),
          contract_date: toDateOrNull(row.contractDate),
          condition_status: row.status || null,
          contract_kind: kind,
          mysoku_pdf_path: pdfPath,
        })
      }

      await insertEntries(supabase, payloads)

      router.push(`/tab-list?complexId=${encodeURIComponent(selectedComplex.id)}`)
    } catch (e) {
      console.error('[tab-regist:save]', e)
      setMsg('保存に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const complexLocation = useMemo(() => {
    if (!selectedComplex) return '—'
    return [selectedComplex.pref ?? '', selectedComplex.city ?? '', selectedComplex.town ?? ''].filter(Boolean).join(' ') || '—'
  }, [selectedComplex])

  const complexStation = useMemo(() => {
    if (!selectedComplex || !selectedComplex.stationName) return '—'
    return selectedComplex.stationName
  }, [selectedComplex])

  const complexStationWalk = useMemo(() => {
    if (!selectedComplex || selectedComplex.stationMinutes == null) return '—'
    const access = selectedComplex.stationAccessType ?? '徒歩'
    return `${access}${selectedComplex.stationMinutes}分`
  }, [selectedComplex])

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <h1 className="text-lg font-semibold">過去成約登録（1成約1行）</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserEmail />
              <button
                className="px-3 py-1.5 bg-gray-100 rounded-lg"
                onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}
              >
                サインアウト
              </button>
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
            <ul className="flex flex-wrap items-center gap-2 text-sm">
              <li><Link href="/tab-complex-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地一覧</Link></li>
              <li><Link href="/tab-complex" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地基本情報</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">過去成約登録</span></li>
              <li><Link href="/tab-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約一覧</Link></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="bg-white rounded-2xl shadow p-5 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">全成約事例 入力フォーム</h2>
                {msg ? (
                  <p className="mt-1 inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                    {msg}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    1行に1成約を入力してください。MAX/MINIラベルは各1件のみ、PDF添付はその2件のみ可能です。
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1">
                  並び替え
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  順序
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={sortDirection}
                    onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                    disabled={sortKey === 'input_order'}
                  >
                    <option value="desc">降順</option>
                    <option value="asc">昇順</option>
                  </select>
                </label>
              </div>
            </div>

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
                  {complexes.length === 0 && <option value="">団地がありません（先に団地基本情報を登録してください）</option>}
                </select>
              </label>
              <div className="rounded-xl border border-gray-200 p-3 bg-gray-50 text-xs text-gray-600">
                団地基本情報（団地名/所在地/最寄り駅/徒歩時間/総戸数）は各行に自動表示されます。
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-[2200px] w-full text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="text-left p-2 border-b">行</th>
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
                      <th className="text-left p-2 border-b">12 ㎡単価(自動)</th>
                      <th className="text-left p-2 border-b">13 レインズ登録年月日</th>
                      <th className="text-left p-2 border-b">14 レインズ成約年月日</th>
                      <th className="text-left p-2 border-b">15 経過日数(14-13)</th>
                      <th className="text-left p-2 border-b">16 状態</th>
                      <th className="text-left p-2 border-b">ラベル</th>
                      <th className="text-left p-2 border-b">PDF（MAX/MINIのみ）</th>
                      <th className="text-left p-2 border-b">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => {
                      const unitPrice = calcUnitPriceFromStrings(row.price, row.area)
                      const elapsedDays = calcElapsedDays(row.reinsDate, row.contractDate)
                      return (
                        <tr key={row.id} className="border-b align-top">
                          <td className="p-2 bg-gray-50 font-semibold">{idx + 1}</td>
                          <td className="p-2 bg-gray-50 min-w-44">{selectedComplex?.name ?? '—'}</td>
                          <td className="p-2 bg-gray-50 min-w-52">{complexLocation}</td>
                          <td className="p-2 bg-gray-50 min-w-36">{complexStation}</td>
                          <td className="p-2 bg-gray-50 min-w-32">{complexStationWalk}</td>
                          <td className="p-2 bg-gray-50 min-w-24">{selectedComplex?.unitCount != null ? `${selectedComplex.unitCount}戸` : '—'}</td>
                          <td className="p-2 min-w-28">
                            <select
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.elevator}
                              onChange={(e) => updateRowField(row.id, 'elevator', e.target.value)}
                            >
                              <option value="あり">あり</option>
                              <option value="なし">なし</option>
                              <option value="スキップ">スキップ</option>
                            </select>
                          </td>
                          <td className="p-2 min-w-44">
                            <input
                              type="month"
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.builtYm}
                              onChange={(e) => updateRowField(row.id, 'builtYm', e.target.value)}
                            />
                            <p className="text-[11px] text-gray-500 mt-1">{formatMonthWithEra(row.builtYm)}</p>
                          </td>
                          <td className="p-2 min-w-24">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.buildingNo}
                              onChange={(e) => updateRowField(row.id, 'buildingNo', e.target.value)}
                            />
                          </td>
                          <td className="p-2 min-w-24">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.floor}
                              onChange={(e) => updateRowField(row.id, 'floor', e.target.value)}
                            />
                          </td>
                          <td className="p-2 min-w-40">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.price}
                              onChange={(e) => updateRowField(row.id, 'price', e.target.value)}
                            />
                            <p className="text-[11px] text-gray-500 mt-1">{formatYen(toFloatOrNull(row.price))}</p>
                          </td>
                          <td className="p-2 min-w-32">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.area}
                              onChange={(e) => updateRowField(row.id, 'area', e.target.value)}
                            />
                          </td>
                          <td className="p-2 min-w-36">
                            <div className="w-full border rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600">{formatUnitPrice(unitPrice)}</div>
                          </td>
                          <td className="p-2 min-w-44">
                            <input
                              type="date"
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.reinsDate}
                              onChange={(e) => updateRowField(row.id, 'reinsDate', e.target.value)}
                            />
                            <p className="text-[11px] text-gray-500 mt-1">{formatDateWithEra(row.reinsDate)}</p>
                          </td>
                          <td className="p-2 min-w-44">
                            <input
                              type="date"
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.contractDate}
                              onChange={(e) => updateRowField(row.id, 'contractDate', e.target.value)}
                            />
                            <p className="text-[11px] text-gray-500 mt-1">{formatDateWithEra(row.contractDate)}</p>
                          </td>
                          <td className="p-2 min-w-28">
                            <div className="w-full border rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600">
                              {elapsedDays == null ? '—' : `${elapsedDays}日`}
                            </div>
                          </td>
                          <td className="p-2 min-w-56">
                            <select
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.status}
                              onChange={(e) => updateRowField(row.id, 'status', e.target.value)}
                            >
                              <option value="">選択</option>
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 min-w-24">
                            <select
                              className="w-full border rounded-lg px-2 py-1.5"
                              value={row.label}
                              onChange={(e) => updateRowField(row.id, 'label', e.target.value)}
                            >
                              <option value="">なし</option>
                              <option value="MAX">MAX</option>
                              <option value="MINI">MINI</option>
                            </select>
                          </td>
                          <td className="p-2 min-w-56">
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={!row.label}
                              className="w-full border rounded-lg px-2 py-1.5 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                              onChange={(e: ChangeEvent<HTMLInputElement>) => updateRowPdf(row.id, e.target.files?.[0] ?? null)}
                            />
                          </td>
                          <td className="p-2 min-w-20">
                            <button
                              type="button"
                              className="px-2 py-1 rounded bg-gray-100 text-xs disabled:opacity-50"
                              disabled={rows.length <= 1}
                              onClick={() => removeRow(row.id)}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm"
                  onClick={addRow}
                >
                  行を追加
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm disabled:opacity-60"
                  disabled={saving || !selectedComplex}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}

export default function TabRegistPage() {
  return (
    <Suspense fallback={null}>
      <TabRegistPageContent />
    </Suspense>
  )
}
