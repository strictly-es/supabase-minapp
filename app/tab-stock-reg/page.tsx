'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toIntOrNull } from '@/lib/entryMath'
import { loadComplexReferenceSummaries } from '@/lib/repositories/complexEdit'
import { buildFloorRows, calcBaseUnitPrice, safeNumber } from '@/lib/stockPricing'
import {
  insertStock,
  loadStockEntryContext,
  listMaxEntriesForComplex,
  listStockComplexes,
  uploadStockPdf,
} from '@/lib/repositories/stocks'
import { getSupabase } from '@/lib/supabaseClient'
import { useClientSearchParams } from '@/lib/useClientSearchParams'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import StockForm from '../tab-stock/StockForm'
import type { ReferenceValueEntry } from '@/lib/referenceValue'
import type { StockComplexOption as Complex, StockEntryOption as Entry, StockFormState as FormState } from '../tab-stock/stockFormShared'

const initialForm: FormState = {
  floor: '',
  area: '',
  layout: '',
  registered: '',
  maxUnit: '',
  coefTotal: '1.00',
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

export default function StockRegPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useClientSearchParams()
  const requestedEntryId = searchParams?.get('entryId') ?? ''
  const requestedComplexId = searchParams?.get('complexId') ?? ''

  const [complexes, setComplexes] = useState<Complex[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState<string>('')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [form, setForm] = useState<FormState>(initialForm)
  const [pdf, setPdf] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [requestedEntryHandled, setRequestedEntryHandled] = useState(false)
  const [referenceRows, setReferenceRows] = useState<ReferenceValueEntry[]>([])

  useEffect(() => {
    if (!requestedEntryId || requestedEntryHandled) return
    let mounted = true
    async function loadRequestedEntry() {
      try {
        const entry = await loadStockEntryContext(supabase, requestedEntryId)
        if (!mounted || !entry) return
        if (entry.complexId) setSelectedComplexId(entry.complexId)
        if (entry.contractKind === 'MAX') {
          setSelectedEntryId(entry.id)
        } else {
          setMsg('指定成約はMAXではないため、同団地のMAX成約を選択してください')
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('指定成約の読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setRequestedEntryHandled(true)
      }
    }
    loadRequestedEntry()
    return () => { mounted = false }
  }, [requestedEntryHandled, requestedEntryId, supabase])

  const selectedComplex = useMemo(() => complexes.find((c) => c.id === selectedComplexId) ?? null, [complexes, selectedComplexId])
  const selectedEntry = useMemo(() => entries.find((e) => e.id === selectedEntryId) ?? null, [entries, selectedEntryId])

  useEffect(() => {
    let mounted = true
    async function loadComplexes() {
      try {
        const list = await listStockComplexes(supabase)
        if (mounted) {
          setComplexes(list)
          if (!selectedComplexId) {
            if (requestedComplexId && list.some((item) => item.id === requestedComplexId)) {
              setSelectedComplexId(requestedComplexId)
            } else if (list[0]) {
              setSelectedComplexId(list[0].id)
            }
          }
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [requestedComplexId, selectedComplexId, supabase])

  useEffect(() => {
    if (!selectedComplexId) { setEntries([]); return }
    let mounted = true
    async function loadEntries() {
      try {
        const list = await listMaxEntriesForComplex(supabase, selectedComplexId)
        if (mounted) {
          setEntries(list)
          if (requestedEntryId && list.length === 0) {
            setSelectedEntryId('')
            setMsg('この団地にはMAX成約がないため在庫登録できません。先にMAX成約を登録してください')
          } else if (requestedEntryId && list.some((item) => item.id === requestedEntryId)) {
            setSelectedEntryId(requestedEntryId)
          } else if (!selectedEntryId && list[0]) {
            setSelectedEntryId(list[0].id)
          }
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('過去成約取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadEntries()
    return () => { mounted = false }
  }, [requestedEntryId, selectedComplexId, selectedEntryId, supabase])

  useEffect(() => {
    if (!selectedComplexId) {
      setReferenceRows([])
      return
    }
    let mounted = true
    async function loadReferenceRows() {
      try {
        const { rows } = await loadComplexReferenceSummaries(supabase, selectedComplexId)
        if (mounted) setReferenceRows(rows)
      } catch (e) {
        console.error(e)
        if (mounted) setReferenceRows([])
      }
    }
    loadReferenceRows()
    return () => { mounted = false }
  }, [selectedComplexId, supabase])

  // 当該成約を選択したら、面積/間取り/係数/㎡単価を初期セット
  useEffect(() => {
    if (!selectedEntry) return
    setForm((prev) => ({
      ...prev,
      area: prev.area || (selectedEntry.area != null ? selectedEntry.area.toString() : ''),
      layout: prev.layout || (selectedEntry.layout ?? ''),
      maxUnit: prev.maxUnit || calcBaseUnitPrice(selectedEntry.maxPrice, selectedEntry.area),
      coefTotal: prev.coefTotal || (selectedEntry.coefTotal != null ? selectedEntry.coefTotal.toFixed(2) : '1.00'),
    }))
  }, [selectedEntry])

  const baseUnit = useMemo(() => safeNumber(form.maxUnit), [form.maxUnit])
  const baseCoef = useMemo(() => safeNumber(form.coefTotal) || 1, [form.coefTotal])
  const areaNum = useMemo(() => safeNumber(form.area), [form.area])
  const floors = useMemo(
    () => buildFloorRows(baseUnit, baseCoef, areaNum, selectedComplex?.floorPattern),
    [selectedComplex?.floorPattern, baseUnit, baseCoef, areaNum],
  )

  const selectedFloorNum = useMemo(() => {
    const n = Number.parseInt(form.floor, 10)
    return Number.isFinite(n) ? n : null
  }, [form.floor])
  const selectedFloorRow = floors.find((f) => f.floor === selectedFloorNum) ?? floors[0]

  const onFormChange = <K extends keyof FormState>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setSaving(true); setMsg('保存中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); setSaving(false); return }
      if (!selectedComplexId) { setMsg('団地を選択してください'); setSaving(false); return }
      if (!selectedEntryId) { setMsg('紐づく過去成約（MAX）を選択してください'); setSaving(false); return }
      const area = safeNumber(form.area) || null
      if (!area || area <= 0) { setMsg('面積を入力してください'); setSaving(false); return }

      const stock_mysoku_path = await uploadStockPdf(supabase, pdf, user.id)
      const target = selectedFloorRow
      const payload = {
        created_by: user.id,
        estate_entry_id: selectedEntryId,
        complex_id: selectedComplexId,
        floor: toIntOrNull(form.floor),
        area_sqm: area,
        layout: form.layout.trim() || null,
        registered_date: form.registered || null,
        list_price: target?.targetClose ?? null,
        base_unit_price: baseUnit || null,
        coef_total: baseCoef || null,
        floor_coef: target?.floorCoef ?? null,
        target_unit_price: target?.targetUnit ?? null,
        target_close_price: target?.targetClose ?? null,
        raise_price: target?.raise ?? null,
        buy_target_price: target?.buyTarget ?? null,
        stock_mysoku_path,
      }
      await insertStock(supabase, payload)
      setMsg('保存しました')
      setForm(initialForm)
      setPdf(null)
      router.push(`/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}`)
    } catch (e) {
      console.error('[stock/save]', e)
      setMsg('保存に失敗しました: ' + toErrorMessage(e))
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
              <h1 className="text-lg font-semibold">在庫（検討）物件登録</h1>
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
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">在庫登録</span></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">団地 / 過去成約 に紐づく在庫登録</h2>
                <span className="text-sm text-gray-500">{msg || '入力後、保存してください'}</span>
              </div>

              <form id="form-stock" className="space-y-6" onSubmit={(ev) => { handleSubmit(ev).catch(console.error) }}>
                <StockForm
                  selectedComplexId={selectedComplexId}
                  complexes={complexes}
                  selectedEntryId={selectedEntryId}
                  entries={entries}
                  selectedComplex={selectedComplex}
                  selectedEntry={selectedEntry}
                  form={form}
                  floors={floors}
                  selectedFloorNum={selectedFloorNum}
                  referenceRows={referenceRows}
                  saving={saving}
                  submitLabel="保存"
                  onComplexChange={(value) => { setSelectedComplexId(value); setSelectedEntryId('') }}
                  onEntryChange={setSelectedEntryId}
                  onFormChange={onFormChange}
                  onPdfChange={setPdf}
                  onReset={() => { setForm(initialForm); setPdf(null); setMsg('') }}
                />
              </form>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
