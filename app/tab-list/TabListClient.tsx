'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type ComplexOption = { id: string; name: string; pref: string | null; city: string | null; floorPattern: string | null }

type EntryRow = {
  id: string
  contract_kind: 'MAX' | 'MINI' | null
  floor: number | null
  area_sqm: number | null
  layout: string | null
  reins_registered_date: string | null
  contract_date: string | null
  max_price: number | null
  past_min: number | null
  coef_total: number | null
  interior_level_coef: number | null
  contract_year_coef: number | null
}

type Card = {
  kind: 'MAX' | 'MINI'
  entryId: string
  summary: {
    unit: number
    floor: number | null
    price: number
    area: number
    layout: string
    reins: string
    contract: string
    days: number
    coefTotal: number
  }
  floors: {
    floor: number
    predictedUnit: number
    targetUnit: number
    raise: number
    buyTargetUnit: number
  }[]
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

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(+d) ? null : d
}

function diffDays(a: string | null, b: string | null): number {
  const da = parseDate(a); const db = parseDate(b)
  if (!da || !db) return 0
  const ms = Math.abs(+da - +db)
  return Math.round(ms / 86400000)
}

function fmtYen(n: number): string { return n.toLocaleString('ja-JP') + '円' }
function fmtUnit(n: number): string { return fmtYen(n) + '/㎡' }
function safeNum(n: number | null | undefined): number { return typeof n === 'number' && Number.isFinite(n) ? n : 0 }

export default function TabListClient() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState<string>('')
  const [floorPattern, setFloorPattern] = useState<string | null>(null)

  const [entries, setEntries] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)


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
          const qsId = searchParams?.get('complexId') ?? ''
          const preselect = qsId || selectedComplexId
          const cur = preselect ? list.find((x) => x.id === preselect) : undefined
          if (cur) {
            setSelectedComplexId(cur.id)
            setFloorPattern(cur.floorPattern ?? null)
          } else if (list[0]) {
            setSelectedComplexId(list[0].id)
            setFloorPattern(list[0].floorPattern ?? null)
          }
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, searchParams])

  useEffect(() => {
    if (!selectedComplexId) return
    let mounted = true
    async function loadEntries() {
      setLoading(true); setMsg('')
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, contract_kind, floor, area_sqm, layout, reins_registered_date, contract_date, max_price, past_min, coef_total, interior_level_coef, contract_year_coef')
          .eq('complex_id', selectedComplexId)
          .is('deleted_at', null)
          .order('contract_date', { ascending: false, nullsFirst: false })
          .limit(500)
        if (error) throw error
        const rows = (data ?? []) as EntryRow[]
        const pattern = floorPattern ?? ''
        const coefArr = floorCoefs[pattern] ?? null
        const mapped: Card[] = ['MAX', 'MINI'].map((kind) => {
          const list = rows.filter((r) => r.contract_kind === kind)
          if (list.length === 0) return null
          const base = list[0]
          const area = safeNum(base.area_sqm)
          const price = kind === 'MAX' ? safeNum(base.max_price) : safeNum(base.past_min)
          const unit = area > 0 ? Math.round(price / area) : 0
          const baseCoef = safeNum(base.coef_total ?? (safeNum(base.interior_level_coef) + safeNum(base.contract_year_coef))) || 1
          const floors = (coefArr ?? [1, 1, 1, 1, 1]).map((c, idx) => {
            const predictedUnit = Math.round(unit * c)
            const targetUnit = Math.round(unit * baseCoef * c)
            const targetClose = Math.round(targetUnit * area)
            const raiseFloat = targetClose / 1.21
            const raise = Math.floor(raiseFloat / 10000) * 10000
            const moveCost = area < 60 ? Math.round(area * 132000) : (area >= 80 ? Math.round(area * 123000) : Math.round(area * (132000 - (area - 60) * 400)))
            const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
            const other = Math.round(raise * 0.075)
            const buyTarget = raise - moveCost - brokerage - other
            const buyTargetUnit = area > 0 ? Math.round(buyTarget / area) : 0
            return { floor: idx + 1, predictedUnit, targetUnit, raise, buyTargetUnit }
          })
          return {
            kind: kind as 'MAX' | 'MINI',
            entryId: base.id,
            summary: {
              unit,
              floor: base.floor,
              price,
              area,
              layout: (base.layout ?? '').trim(),
              reins: base.reins_registered_date ?? '',
              contract: base.contract_date ?? '',
              days: diffDays(base.reins_registered_date, base.contract_date),
              coefTotal: baseCoef,
            },
            floors,
          }
        }).filter(Boolean) as Card[]
        if (mounted) setEntries(mapped)
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('成約一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadEntries()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, floorPattern, reloadKey])

  const filtered = entries

  const headerMsg = useMemo(() => {
    if (loading) return '読み込み中...'
    if (msg) return msg
    return `全${filtered.length}件`
  }, [loading, msg, filtered.length])

  const selectedComplexName = useMemo(() => {
    const c = complexes.find((x) => x.id === selectedComplexId)
    if (!c) return '団地未選択'
    const loc = [c.pref ?? '', c.city ?? ''].filter(Boolean).join(' / ')
    return `${c.name}${loc ? `（${loc}）` : ''}`
  }, [complexes, selectedComplexId])

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

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <div>
                <h1 className="text-lg font-semibold">過去成約一覧（団地別）</h1>
                <p className="text-xs text-gray-500">団地1件に対する階別の MAX / MINI 成約履歴</p>
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
                  <div className="text-xl font-semibold">{selectedComplexName}</div>
                  <div className="text-xs text-gray-500">階数効用: {floorPattern || '未設定'}</div>
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

              <div className="grid md:grid-cols-1 gap-3">
                <section className="bg-white rounded-2xl shadow overflow-hidden border">
                  <div className="border-b p-4 flex items-center justify-between text-sm text-gray-600">
                    <span>過去成約カード（階別 / MAX・MINI）</span>
                    <div className="text-xs text-gray-500">目標単価・買付目標額も合わせて確認</div>
                  </div>
                  <div className="divide-y" id="entries">
                    {filtered.map((d) => (
                      <article key={d.kind} className="p-4 border-b last:border-b-0 hover:bg-gray-50 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${d.kind === 'MAX' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{d.kind}</span>
                          <span className="text-sm text-gray-700 font-semibold">㎡単価: {d.summary.unit ? fmtUnit(d.summary.unit) : '—'}</span>
                          <span className="text-sm text-gray-600">階数: {d.summary.floor != null ? `${d.summary.floor}階` : '—'}</span>
                          <span className="text-sm text-gray-600">成約価格（㎡数）: <span className="font-semibold num">{d.summary.price ? fmtYen(d.summary.price) : '—'}</span></span>
                        </div>
                        <div className="grid md:grid-cols-5 gap-3 text-sm">
                          <div><div className="text-gray-500">登録日</div><div>{d.summary.reins || '—'}</div></div>
                          <div><div className="text-gray-500">成約日</div><div>{d.summary.contract || '—'}</div></div>
                          <div><div className="text-gray-500">間取り</div><div>{d.summary.layout || '—'}</div></div>
                          <div><div className="text-gray-500">面積</div><div className="num">{d.summary.area ? `${d.summary.area.toFixed(2)}㎡` : '—'}</div></div>
                          <div><div className="text-gray-500">日数</div><div className="num">{d.summary.days ? `${d.summary.days}日` : '—'}</div></div>
                        </div>
                        <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-50">
                          <table className="w-full text-xs">
                            <thead className="text-gray-600 bg-gray-100">
                              <tr>
                                <th className="text-left py-2 px-2">階</th>
                                <th className="text-right py-2 px-2">階別成約単価(予測)</th>
                                {d.kind === 'MAX' ? (
                                  <>
                                    <th className="text-right py-2 px-2">目標成約価格</th>
                                    <th className="text-right py-2 px-2">募集総額（目安）</th>
                                    <th className="text-right py-2 px-2">買付目標価格</th>
                                  </>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              {d.floors.map((f) => (
                                <tr className="border-t" key={`${d.kind}-${f.floor}`}>
                                  <td className="py-2 px-2">{f.floor}F</td>
                                  <td className="py-2 px-2 text-right num">{f.predictedUnit ? fmtUnit(f.predictedUnit) : '—'}</td>
                                  {d.kind === 'MAX' ? (
                                    <>
                                      <td className="py-2 px-2 text-right num">{f.targetUnit ? fmtUnit(f.targetUnit) : '—'}</td>
                                      <td className="py-2 px-2 text-right num">{f.raise ? fmtYen(f.raise) : '—'}</td>
                                      <td className="py-2 px-2 text-right text-emerald-700 font-semibold num">{f.buyTargetUnit ? fmtUnit(f.buyTargetUnit) : '—'}</td>
                                    </>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <Link className="underline text-blue-700" href={`/tab-regist/${encodeURIComponent(d.entryId)}/edit`}>編集</Link>
                          <button
                            type="button"
                            className="underline text-red-700 disabled:opacity-50"
                            onClick={() => { handleDelete(d.entryId).catch(console.error) }}
                            disabled={deletingId === d.entryId}
                          >
                            {deletingId === d.entryId ? '削除中...' : '削除'}
                          </button>
                          <span className="h-4 w-px bg-gray-200" aria-hidden="true" />
                          <Link className="underline text-blue-700" href={`/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}`}>在庫一覧へ</Link>
                          <Link className="underline text-blue-700" href="/tab-stock-reg">在庫登録へ</Link>
                        </div>
                      </article>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <div className="p-6 text-sm text-gray-500">条件に一致する成約がありません。</div>
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
