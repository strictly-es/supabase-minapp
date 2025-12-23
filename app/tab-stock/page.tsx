'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import { getSupabase } from '@/lib/supabaseClient'
import { useSearchParams } from 'next/navigation'

type Complex = { id: string; name: string; pref: string | null; city: string | null }

type StockRow = {
  id: string
  complex_id: string | null
  estate_entry_id: string | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  registered_date: string | null
  contract_date: string | null
  list_price: number | null
  target_unit_price: number | null
  target_close_price: number | null
  buy_target_price: number | null
  raise_price: number | null
  base_unit_price: number | null
  coef_total: number | null
  floor_coef: number | null
  status: string | null
  stock_mysoku_path: string | null
  estate_entries?: {
    renovated: boolean | null
    contract_kind: string | null
    estate_name: string | null
  } | {
    renovated: boolean | null
    contract_kind: string | null
    estate_name: string | null
  }[] | null
}

type Card = {
  id: string
  floor: number | null
  area: number
  layout: string
  reg: string
  contract: string
  price: number
  unit: number
  targetUnit: number
  targetPrice: number
  buyTarget: number
  raise: number
  status: string
  days: number
  renovated: boolean | null
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function safeNum(n: number | null | undefined): number { return typeof n === 'number' && Number.isFinite(n) ? n : 0 }
function parseDate(s: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(+d) ? null : d }
function diffDays(a: string | null): number {
  const da = parseDate(a)
  if (!da) return 0
  const now = new Date()
  const ms = Math.abs(+now - +da)
  return Math.round(ms / 86400000)
}
function fmtYen(n: number): string { return n.toLocaleString('ja-JP') + ' 円' }

export default function TabStockListPage() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const [complexes, setComplexes] = useState<Complex[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState<string>('')
  const [cards, setCards] = useState<Card[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [fFloorMin, setFFloorMin] = useState('')
  const [fAreaMin, setFAreaMin] = useState('')
  const [fTargetPriceMax, setFTargetPriceMax] = useState('')
  const [fBuyMax, setFBuyMax] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fRenovated, setFRenovated] = useState('')

  useEffect(() => {
    let mounted = true
    async function loadComplexes() {
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select('id, name, pref, city')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        const list = (data ?? []).map((c) => ({
          id: c.id as string,
          name: (c.name as string) ?? '(名称未設定)',
          pref: (c.pref as string | null) ?? null,
          city: (c.city as string | null) ?? null,
        }))
        if (mounted) {
          setComplexes(list)
          const qsId = searchParams?.get('complexId') ?? ''
          const pre = qsId || selectedComplexId
          const found = pre ? list.find((c) => c.id === pre) : undefined
          if (found) setSelectedComplexId(found.id)
          else if (!selectedComplexId && list[0]) setSelectedComplexId(list[0].id)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, searchParams])

  useEffect(() => {
    if (!selectedComplexId) { setCards([]); return }
    let mounted = true
    async function loadStocks() {
      setLoading(true); setMsg('')
      try {
        const { data, error } = await supabase
          .from('estate_stocks')
          .select(`
            id, complex_id, estate_entry_id, floor, area_sqm, layout, registered_date, contract_date, list_price,
            target_unit_price, target_close_price, buy_target_price, raise_price,
            base_unit_price, coef_total, floor_coef, status, stock_mysoku_path,
            estate_entries ( renovated, contract_kind, estate_name )
          `)
          .eq('complex_id', selectedComplexId)
          .is('deleted_at', null)
          .order('registered_date', { ascending: false, nullsFirst: false })
          .limit(500)
        if (error) throw error
        const rows = (data ?? []) as StockRow[]
        const mapped: Card[] = rows.map((r) => {
          const entry = Array.isArray(r.estate_entries) ? (r.estate_entries[0] ?? null) : (r.estate_entries ?? null)
          const area = safeNum(r.area_sqm)
          const listPrice = safeNum(r.list_price)
          const unitStored = safeNum(r.target_unit_price)
          const baseUnit = safeNum(r.base_unit_price)
          const coef = safeNum(r.coef_total) || 1
          const floorCoef = safeNum(r.floor_coef) || 1
          const unit = area > 0 ? Math.round(listPrice / area) : 0
          const targetUnit = unitStored || Math.round(baseUnit * coef * floorCoef)
          const targetPriceStored = safeNum(r.target_close_price)
          const targetPrice = targetPriceStored || Math.round(targetUnit * area)
          const raiseStored = safeNum(r.raise_price)
          const raise = raiseStored || Math.floor((targetPrice / 1.21) / 10000) * 10000
          const buyStored = safeNum(r.buy_target_price)
          const moveCost = area < 60 ? Math.round(area * 132000) : (area >= 80 ? Math.round(area * 123000) : Math.round(area * (132000 - (area - 60) * 400)))
          const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
          const other = Math.round(raise * 0.075)
          const buyTarget = buyStored || (raise - moveCost - brokerage - other)
          return {
            id: r.id,
            floor: r.floor,
            area,
            layout: (r.layout ?? '').trim(),
            reg: r.registered_date ?? '',
            contract: r.contract_date ?? '',
            price: listPrice,
            unit,
            targetUnit,
            targetPrice,
            buyTarget,
            raise,
            status: (r.status ?? '未設定') as string,
            days: diffDays(r.registered_date),
            renovated: entry?.renovated ?? null,
          }
        })
        if (mounted) setCards(mapped)
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('在庫取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadStocks()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, reloadKey])

  const filtered = useMemo(() => {
    const floorMin = Number.parseInt(fFloorMin, 10)
    const areaMin = Number.parseFloat(fAreaMin)
    const targetMax = Number.parseFloat(fTargetPriceMax)
    const buyMax = Number.parseFloat(fBuyMax)
    return cards.filter((c) => {
      if (Number.isFinite(floorMin) && floorMin > 0 && (typeof c.floor === 'number') && c.floor < floorMin) return false
      if (Number.isFinite(areaMin) && areaMin > 0 && c.area < areaMin) return false
      if (Number.isFinite(targetMax) && targetMax > 0 && c.targetPrice > targetMax) return false
      if (Number.isFinite(buyMax) && buyMax > 0 && c.buyTarget > buyMax) return false
      if (fStatus && c.status !== fStatus) return false
      if (fRenovated) {
        if (fRenovated === 'yes' && c.renovated !== true) return false
        if (fRenovated === 'no' && c.renovated !== false) return false
      }
      return true
    })
  }, [cards, fFloorMin, fAreaMin, fTargetPriceMax, fBuyMax, fStatus, fRenovated])

  const headerMsg = useMemo(() => {
    if (loading) return '読み込み中...'
    if (msg) return msg
    return `全${filtered.length}件`
  }, [loading, msg, filtered.length])

  const selectedComplexLabel = useMemo(() => {
    const c = complexes.find((x) => x.id === selectedComplexId)
    if (!c) return '団地未選択'
    const loc = [c.pref ?? '', c.city ?? ''].filter(Boolean).join(' / ')
    return `${c.name}${loc ? `（${loc}）` : ''}`
  }, [complexes, selectedComplexId])

  async function handleDelete(stockId: string) {
    const ok = window.confirm('この在庫を削除しますか？')
    if (!ok) return
    setDeletingId(stockId); setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) throw new Error('ログインが必要です')
      const payload: { deleted_at: string; deleted_by?: string } = { deleted_at: new Date().toISOString() }
      if (user.id) payload.deleted_by = user.id
      const { error } = await supabase
        .from('estate_stocks')
        .update(payload)
        .eq('id', stockId)
      if (error) throw error
      setMsg('削除しました')
      setReloadKey((k) => k + 1)
    } catch (e) {
      console.error('[stock:delete]', e)
      setMsg('削除に失敗しました: ' + toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <div>
                <h1 className="text-lg font-semibold">在庫一覧（団地/成約に紐付く）</h1>
                <p className="text-xs text-gray-500">目標成約価格・買付目標額を並べて確認</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserEmail />
              <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}>サインアウト</button>
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
            <ul className="flex flex-wrap gap-2 text-sm">
              <li><Link href="/tab-complex-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地一覧</Link></li>
              <li><Link href="/tab-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約一覧</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">在庫一覧</span></li>
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
                  <div className="text-xl font-semibold">{selectedComplexLabel}</div>
                </div>
                <span className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">表示件数
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{filtered.length}</span>
                  </label>
                  <label className="flex items-center gap-1">状態
                    <span className="text-gray-500">{headerMsg}</span>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 space-y-4 border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">フィルタ</h3>
                    <button className="text-sm text-gray-500" type="button" onClick={() => { setFFloorMin(''); setFAreaMin(''); setFTargetPriceMax(''); setFBuyMax(''); setFStatus(''); setFRenovated(''); }}>
                      リセット
                    </button>
                  </div>
                  <label className="block text-sm">団地
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedComplexId} onChange={(e) => setSelectedComplexId(e.target.value)}>
                      {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      {complexes.length === 0 && <option value="">団地なし（先に登録）</option>}
                    </select>
                  </label>
                  <label className="block text-sm">階数（以上）
                    <input type="number" min="0" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="3" value={fFloorMin} onChange={(e) => setFFloorMin(e.target.value)} />
                  </label>
                  <label className="block text-sm">面積（㎡）以上
                    <input type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="50" value={fAreaMin} onChange={(e) => setFAreaMin(e.target.value)} />
                  </label>
                  <label className="block text-sm">目標成約価格（上限）
                    <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="20000000" value={fTargetPriceMax} onChange={(e) => setFTargetPriceMax(e.target.value)} />
                  </label>
                  <label className="block text-sm">買付目標額（上限）
                    <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 num" placeholder="12000000" value={fBuyMax} onChange={(e) => setFBuyMax(e.target.value)} />
                  </label>
                  <label className="block text-sm">ステータス
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                      <option value="">指定なし</option>
                      <option value="問い合わせ">問い合わせ</option>
                      <option value="内見">内見</option>
                      <option value="収支検討">収支検討</option>
                      <option value="買付">買付</option>
                      <option value="契約締結">契約締結</option>
                      <option value="引き渡し">引き渡し</option>
                    </select>
                  </label>
                  <label className="block text-sm">リノベ有無
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={fRenovated} onChange={(e) => setFRenovated(e.target.value)}>
                      <option value="">指定なし</option>
                      <option value="yes">有</option>
                      <option value="no">無</option>
                    </select>
                  </label>
                </aside>

                <section className="md:col-span-3 bg-white rounded-2xl shadow overflow-hidden border">
                  <div className="border-b p-4 flex items-center justify-between text-sm text-gray-600">
                    <span>在庫カード（目標成約価格 / 買付目標額）</span>
                    <div className="text-xs text-gray-500">MAX係数 × 階効用で目標計算（参考表示）</div>
                  </div>
                  <div id="stocks" className="divide-y">
                    {filtered.map((d) => (
                      <article key={d.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-600">階数 {d.floor != null ? `${d.floor}階` : '—'} / {d.area ? d.area.toFixed(2) : '—'}㎡ / {d.layout || '—'}</span>
                          <span className="text-xs text-gray-500">登録: {d.reg || '-'}</span>
                          {d.status === '買付' && <span className="badge badge-hot text-xs">買付</span>}
                          {d.days > 0 && d.days < 45 && <span className="badge badge-new text-xs">NEW</span>}
                        </div>
                        <div className="grid md:grid-cols-5 gap-3 text-sm">
                          <div><div className="text-gray-500">販売価格</div><div className="font-semibold num">{fmtYen(d.price)}</div></div>
                          <div><div className="text-gray-500">㎡単価</div><div className="font-semibold num">{d.unit ? fmtYen(d.unit) : '—'}</div></div>
                          <div><div className="text-gray-500">目標単価</div><div className="font-semibold num">{d.targetUnit ? fmtYen(d.targetUnit) : '—'}</div></div>
                          <div><div className="text-gray-500">目標成約価格</div><div className="font-semibold num">{d.targetPrice ? fmtYen(d.targetPrice) : '—'}</div></div>
                          <div><div className="text-gray-500">買付目標額</div><div className="font-semibold text-emerald-700 num">{d.buyTarget ? fmtYen(d.buyTarget) : '—'}</div></div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>経過: {d.days}日 / リノベ: {d.renovated == null ? '—' : d.renovated ? '有' : '無'} / ステータス: {d.status}</span>
                          <div className="flex items-center gap-2 text-sm">
                            <Link className="underline text-blue-700" href={`/tab-stock/${d.id}/edit`}>詳細</Link>
                            <button
                              type="button"
                              className="underline text-red-700 disabled:opacity-50"
                              onClick={() => { handleDelete(d.id).catch(console.error) }}
                              disabled={deletingId === d.id}
                            >
                              {deletingId === d.id ? '削除中...' : '削除'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <div className="p-6 text-sm text-gray-500">条件に一致する在庫がありません。</div>
                    )}
                    {loading && (
                      <div className="p-6 text-sm text-gray-500">読み込み中...</div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
