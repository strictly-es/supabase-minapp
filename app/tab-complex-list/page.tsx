'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import { getSupabase } from '@/lib/supabaseClient'

type Complex = {
  id: string
  name: string
  pref: string | null
  city: string | null
  town: string | null
  built_ym: string | null
  built_age: number | null
  station_name: string | null
  station_access_type: string | null
  station_minutes: number | null
  unit_count: number | null
  has_elevator: boolean | null
  floor_coef_pattern: string | null
  complex_evaluations?: {
    id: string
    total_score: number | null
    factors: Record<string, unknown> | null
    created_at: string
  }[]
}

type Card = {
  id: string
  name: string
  addr: string
  station: string
  built: string
  builtAge: number | null
  units: string
  score: number | null
  hasElevator: boolean
  floorPattern: string
  market: number | null
  loc: number | null
  bld: number | null
  plus: number | null
}

type FactorItem = { score?: number }
type Factors = {
  market?: { deals?: FactorItem; rentDemand?: FactorItem; inventory?: FactorItem }
  location?: { walk?: FactorItem; access?: FactorItem; convenience?: FactorItem }
  building?: { scale?: FactorItem; elevator?: FactorItem; mgmt?: FactorItem; appearance?: FactorItem; parking?: FactorItem; view?: FactorItem }
  plus?: { future?: FactorItem; focus?: FactorItem; support?: FactorItem }
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function formatAddr(pref: string | null, city: string | null, town: string | null): string {
  return [pref ?? '', city ?? '', town ?? ''].filter(Boolean).join(' ')
}

function formatStation(name: string | null, access: string | null, mins: number | null): string {
  if (!name) return ''
  const walk = mins ? `${access ?? ''}${mins}分` : access ?? ''
  return `最寄: ${name}${walk ? ` (${walk})` : ''}`
}

function formatBuilt(ym: string | null, age: number | null): string {
  if (!ym && age == null) return ''
  const y = ym ? ym.replace('-', '/') : ''
  return `${y}${age != null ? ` (築${age}年)` : ''}`.trim()
}

function pickScore(item?: FactorItem): number {
  if (!item || typeof item !== 'object') return 0
  return typeof item.score === 'number' ? item.score : 0
}

export default function TabComplexListPage() {
  const supabase = getSupabase()
  const [cards, setCards] = useState<Card[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [fKey, setFKey] = useState('')
  const [fScoreMin, setFScoreMin] = useState('')
  const [fBuiltAgeMax, setFBuiltAgeMax] = useState('')
  const [fElev, setFElev] = useState('')

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoading(true); setMsg('')
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select(`
            id, name, pref, city, town, built_ym, built_age,
            station_name, station_access_type, station_minutes,
            unit_count, has_elevator, floor_coef_pattern,
            complex_evaluations ( id, total_score, factors, created_at )
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = (data ?? []) as Complex[]
        const mapped: Card[] = rows.map((r) => {
          const evals = [...(r.complex_evaluations ?? [])].sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          const latest = evals[0]
          const factors = (latest?.factors ?? null) as Factors | null
          const market = factors?.market ? pickScore(factors.market.deals) + pickScore(factors.market.rentDemand) + pickScore(factors.market.inventory) : null
          const loc = factors?.location ? pickScore(factors.location.walk) + pickScore(factors.location.access) + pickScore(factors.location.convenience) : null
          const bld = factors?.building ? pickScore(factors.building.scale) + pickScore(factors.building.elevator) + pickScore(factors.building.mgmt) + pickScore(factors.building.appearance) + pickScore(factors.building.parking) + pickScore(factors.building.view) : null
          const plus = factors?.plus ? pickScore(factors.plus.future) + pickScore(factors.plus.focus) + pickScore(factors.plus.support) : null
          return {
            id: r.id,
            name: r.name,
            addr: formatAddr(r.pref, r.city, r.town),
            station: formatStation(r.station_name, r.station_access_type, r.station_minutes),
            built: formatBuilt(r.built_ym, r.built_age),
            builtAge: r.built_age ?? null,
            units: r.unit_count != null ? `${r.unit_count}戸` : '',
            score: latest?.total_score ?? null,
            hasElevator: r.has_elevator ?? false,
            floorPattern: r.floor_coef_pattern ?? '',
            market,
            loc,
            bld,
            plus,
          }
        })
        if (mounted) setCards(mapped)
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase])

  const filtered = useMemo(() => {
    const key = fKey.trim().toLowerCase()
    const scoreMin = Number.parseFloat(fScoreMin)
    const builtAgeMax = Number.parseFloat(fBuiltAgeMax)
    return cards.filter((c) => {
      if (key) {
        const hay = `${c.name} ${c.addr} ${c.station}`.toLowerCase()
        if (!hay.includes(key)) return false
      }
      if (Number.isFinite(scoreMin) && scoreMin > 0) {
        const s = c.score ?? 0
        if (s < scoreMin) return false
      }
      if (Number.isFinite(builtAgeMax) && builtAgeMax > 0 && c.builtAge != null) {
        if (c.builtAge > builtAgeMax) return false
      }
      if (fElev) {
        if (fElev === 'yes' && c.hasElevator !== true) return false
        if (fElev === 'no' && c.hasElevator !== false) return false
      }
      return true
    })
  }, [cards, fKey, fScoreMin, fBuiltAgeMax, fElev])

  const headerMsg = useMemo(() => {
    if (loading) return '読み込み中...'
    if (msg) return msg
    return `全${filtered.length}件`
  }, [loading, msg, filtered.length])

  async function handleDelete(id: string) {
    if (!window.confirm('この団地基本情報を削除しますか？')) return
    setDeletingId(id); setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) throw new Error('ログインが必要です')
      const { error } = await supabase.rpc('delete_housing_complex', {
        p_id: id,
        p_deleted_by: user.id,
      })
      if (error) throw error
      setCards((prev) => prev.filter((c) => c.id !== id))
      setMsg('削除しました')
    } catch (e) {
      console.error(e)
      setMsg('削除に失敗しました: ' + toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }
  function resetFilters() {
    setFKey('')
    setFScoreMin('')
    setFBuiltAgeMax('')
    setFElev('')
  }
  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <h1 className="text-lg font-semibold">団地一覧（団地基本情報レイヤー）</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserEmail />
              <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}>サインアウト</button>
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
            <ul className="flex flex-wrap gap-2 text-sm">
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">団地一覧</span></li>
              <li><Link href="/tab-complex" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地登録</Link></li>
              <li><Link href="/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約登録</Link></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">団地基本情報一覧（スコア重視）</h2>
                <span className="text-sm text-gray-500">{headerMsg}</span>
                <span className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">並び替え
                    <select className="border rounded-lg px-2 py-1 text-sm">
                      <option>総合スコア（降順）</option>
                      <option>市場性</option>
                      <option>立地</option>
                      <option>建物</option>
                      <option>築年</option>
                      <option>MAX単価</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">表示件数
                    <select className="border rounded-lg px-2 py-1 text-sm">
                      <option>20件</option><option>50件</option><option>100件</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3 items-start">
                <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 space-y-4 border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">フィルタ</h3>
                    <button className="text-sm text-gray-500" type="button" onClick={resetFilters}>リセット</button>
                  </div>
                  <label className="block text-sm">キーワード（団地名/所在地/駅）
                    <input
                      type="search"
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      placeholder="例：湘南／藤沢本町／横浜"
                      value={fKey}
                      onChange={(e) => setFKey(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">スコア下限
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="mt-1 w-full border rounded-lg px-3 py-2 num"
                      placeholder="70"
                      value={fScoreMin}
                      onChange={(e) => setFScoreMin(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">築年数（以下）
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full border rounded-lg px-3 py-2 num"
                      placeholder="50"
                      value={fBuiltAgeMax}
                      onChange={(e) => setFBuiltAgeMax(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">エレベーター
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={fElev}
                      onChange={(e) => setFElev(e.target.value)}
                    >
                      <option value="">指定なし</option><option value="yes">有</option><option value="no">無</option>
                    </select>
                  </label>
                </aside>

                <section className="md:col-span-3 bg-white rounded-2xl shadow overflow-hidden border self-start">
                  <div className="border-b p-4 flex items-center justify-between text-sm text-gray-600">
                    <span>スコアカード（団地単位）</span>
                    <div className="text-xs text-gray-500">総合スコアを主要指標として表示</div>
                  </div>
                  <div className="divide-y" id="cards">
                    {filtered.map((c) => (
                      <article key={c.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{c.name}</h3>
                              {c.score != null && <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs">総合 {c.score} / 100</span>}
                              {c.hasElevator && <span className="px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 text-xs">EVあり</span>}
                            </div>
                            <div className="text-sm text-gray-600">{c.addr}</div>
                            <div className="text-xs text-gray-500">{c.station}</div>
                            <div className="text-xs text-gray-500">築年月 {c.built} / 戸数 {c.units}</div>
                            <div className="text-xs text-gray-500">階数効用: {c.floorPattern || '—'}</div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="text-sm text-gray-500">カテゴリ別</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700">市場性 {c.market ?? '—'}</div>
                              <div className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700">立地 {c.loc ?? '—'}</div>
                              <div className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700">建物 {c.bld ?? '—'}</div>
                              <div className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">その他 {c.plus ?? '—'}</div>
                            </div>
                            <div className="flex items-center gap-2 justify-end text-sm">
                              <Link href={`/tab-list?complexId=${encodeURIComponent(c.id)}`} className="underline text-blue-700">過去成約</Link>
                              <Link href={`/tab-stock?complexId=${encodeURIComponent(c.id)}`} className="underline text-blue-700">在庫</Link>
                              <Link href={`/tab-complex/${c.id}/edit`} className="underline text-blue-700">編集</Link>
                              <button
                                type="button"
                                className="underline text-red-700"
                                onClick={() => { handleDelete(c.id).catch(console.error) }}
                                disabled={deletingId === c.id}
                              >
                                {deletingId === c.id ? '削除中...' : '削除'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!loading && cards.length === 0 && (
                      <div className="p-6 text-sm text-gray-500">データがありません。団地登録から追加してください。</div>
                    )}
                    {!loading && cards.length > 0 && filtered.length === 0 && (
                      <div className="p-6 text-sm text-gray-500">条件に一致する団地がありません。</div>
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
