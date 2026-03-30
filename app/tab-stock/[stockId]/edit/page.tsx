'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toDateInputValue, toIntOrNull } from '@/lib/entryMath'
import { loadComplexReferenceSummaries } from '@/lib/repositories/complexEdit'
import {
  buildFloorRows,
  calcBaseUnitPrice,
  safeNumber,
  toFixedString,
  toNumberString,
} from '@/lib/stockPricing'
import {
  createStockPdfSignedUrl,
  listMaxEntriesForComplex,
  listStockComplexes,
  loadStockEdit,
  updateStock,
  uploadStockPdf,
} from '@/lib/repositories/stocks'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import StockForm from '@/app/tab-stock/StockForm'
import type { ReferenceValueEntry } from '@/lib/referenceValue'
import type { StockComplexOption as Complex, StockEntryOption as Entry, StockFormState as FormState } from '@/app/tab-stock/stockFormShared'

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
  const [referenceRows, setReferenceRows] = useState<ReferenceValueEntry[]>([])

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
        const row = await loadStockEdit(supabase, stockId)
        if (!row) {
          if (mounted) setMsg('在庫が見つかりませんでした')
          return
        }
        if (mounted) {
          setSelectedComplexId(row.complex_id ?? '')
          setSelectedEntryId(row.estate_entry_id ?? '')
          setForm({
            floor: toNumberString(row.floor),
            area: toNumberString(row.area_sqm),
            layout: row.layout ?? '',
            registered: toDateInputValue(row.registered_date),
            contract: toDateInputValue(row.contract_date),
            maxUnit: toNumberString(row.base_unit_price),
            coefTotal: toFixedString(row.coef_total, initialForm.coefTotal),
          })
          setExistingPdfPath(row.stock_mysoku_path ?? null)
          setSignedUrl(null)
        }
        if (row.stock_mysoku_path) {
          try {
            const url = await createStockPdfSignedUrl(supabase, row.stock_mysoku_path)
            if (mounted) setSignedUrl(url)
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
        const list = await listStockComplexes(supabase)
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
        const list = await listMaxEntriesForComplex(supabase, selectedComplexId)
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
    if (!stockId) { setMsg('在庫が見つかりません'); return }
    setSaving(true); setMsg('更新中...')
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
      const payload: Record<string, unknown> = {
        estate_entry_id: selectedEntryId,
        complex_id: selectedComplexId,
        floor: toIntOrNull(form.floor),
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

      await updateStock(supabase, stockId, payload)

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
                      submitLabel="更新"
                      showContractDate
                      existingPdf={{ path: existingPdfPath, url: signedUrl }}
                      onComplexChange={(value) => { setSelectedComplexId(value); setSelectedEntryId('') }}
                      onEntryChange={setSelectedEntryId}
                      onFormChange={onFormChange}
                      onPdfChange={setPdf}
                      onReset={() => { setForm(initialForm); setPdf(null); setMsg('') }}
                    />
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
