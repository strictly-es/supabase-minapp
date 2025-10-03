'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabaseClient'

type Row = {
  id: string
  estate_name: string | null
  addr1: string | null
  addr2: string | null
  max_price: number | null
  area_sqm: number | null
  coef_total: number | null
  past_min: number | null
  reins_registered_date: string | null
  contract_date: string | null
  floor: number | null
  has_elevator: boolean | null
}

type Item = {
  id: number
  name: string
  addr1: string
  station: string
  walk: number | null
  built: number | null
  area: number
  listPrice: number
  unitPrice: number
  coefTotal: number
  targetClose: number
  raise: number
  buyTarget: number
  pastMin: number
  pastMax: number
  pastMiniDays: number
  floor: number | null
  hasElev: boolean | null
}

type SortableKey =
  | 'id'
  | 'name'
  | 'walk'
  | 'built'
  | 'area'
  | 'listPrice'
  | 'unitPrice'
  | 'coefTotal'
  | 'targetClose'
  | 'raise'
  | 'buyTarget'
  | 'pastMin'
  | 'pastMax'
  | 'pastMiniDays'

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function safeNum(n: number | null | undefined, d = 0): number { return (typeof n === 'number' && isFinite(n)) ? n : d }
function parseDate(s: string | null): Date | null { if (!s) return null; const d = new Date(s); return isNaN(+d) ? null : d }
function diffDays(a: Date | null, b: Date | null): number { if (!a || !b) return 0; const ms = Math.abs(+a - +b); return Math.round(ms / 86400000) }
function yen(n: number): string { return n.toLocaleString('ja-JP') + '円' }
function sqm(n: number): string { return n.toFixed(2) + '㎡' }

export default function TabListPage() {
  const supabase = getSupabase()

  // View states
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  type CardSortKey = 'unitPrice' | 'buyTarget' | 'pastMin' | 'targetClose' | 'raise' | 'pastMiniDays' | 'coefTotal'
  const [cardSortKey, setCardSortKey] = useState<CardSortKey>('unitPrice')
  const [cardSortAsc, setCardSortAsc] = useState<boolean>(true)
  const [tableSortKey, setTableSortKey] = useState<SortableKey>('id')
  const [tableSortAsc, setTableSortAsc] = useState<boolean>(true)

  // Filters
  const [fKey, setFKey] = useState<string>('')
  const [fArea, setFArea] = useState<string>('')
  const [fFloor, setFFloor] = useState<string>('')
  const [fElev, setFElev] = useState<string>('') // '' | 'yes' | 'no'
  // 金額系（すべて万円入力、内部で×10000）
  const [fBuyMax, setFBuyMax] = useState<string>('') // 買付目標額 上限（万円）
  const [fPastMinMax, setFPastMinMax] = useState<string>('') // 過去MIN 上限（万円）
  const [fTargetCloseMax, setFTargetCloseMax] = useState<string>('') // 目標成約額 上限（万円）
  const [fRaiseMax, setFRaiseMax] = useState<string>('') // 募集総額 上限（万円）

  // Badge thresholds (fixed)
  const thGap = 300000
  const thDays = 30
  const thCoef = 1.05

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoading(true); setMsg('')
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, estate_name, addr1, addr2, max_price, area_sqm, coef_total, past_min, reins_registered_date, contract_date, floor, has_elevator')
          .order('created_at', { ascending: false })
          .limit(1000)
        if (error) throw error
        const rows = (data ?? []) as Row[]
        const mapped: Item[] = rows.map((r, idx) => {
          const name = (r.estate_name ?? '').trim() || '(名称未設定)'
          const adr = [r.addr1 ?? '', r.addr2 ?? ''].filter(Boolean).join(' ')
          const area = safeNum(r.area_sqm, 0)
          const pastMax = safeNum(r.max_price, 0)
          const coef = safeNum(r.coef_total, 1)
          const pastMin = safeNum(r.past_min, 0)
          const unit = area > 0 ? Math.round(pastMax / area) : 0
          const targetClose = Math.round(unit * area * coef)
          // 募集総額 = 目標成約額/1.21 を1万円単位で切り捨て（ROUNDDOWN(number, -4) 相当）
          const raiseFloat = targetClose / 1.21
          const raise = Math.floor(raiseFloat / 10000) * 10000
          // 手数料など差引（仕様メモの式に従う）
          const moveCost = area < 60 ? Math.round(area * 132000) : (area >= 80 ? Math.round(area * 123000) : Math.round(area * (132000 - (area - 60) * 400)))
          const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
          const other = Math.round(raise * 0.075) // その他（募集総額の7.5%）
          // 買付目標額（0未満の場合はマイナスをそのまま表示）
          const buyTarget = raise - moveCost - brokerage - other

          const pastMiniDays = diffDays(parseDate(r.reins_registered_date), parseDate(r.contract_date))
          return {
            id: idx + 1,
            name,
            addr1: adr,
            station: '',
            walk: null,
            built: null,
            area,
            listPrice: raise, // 売出相当を募集総額にマップ
            unitPrice: unit,
            coefTotal: coef,
            targetClose,
            raise,
            buyTarget,
            pastMin,
            pastMax,
            pastMiniDays,
            floor: r.floor ?? null,
            hasElev: (typeof r.has_elevator === 'boolean') ? r.has_elevator : null,
          }
        })
        if (mounted) setItems(mapped)
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
    const areaMin = Number.parseFloat(fArea)
    const floorMin = Number.parseInt(fFloor, 10)
    const buyMaxMan = Number.parseFloat(fBuyMax)
    const pastMinMaxMan = Number.parseFloat(fPastMinMax)
    const targetCloseMaxMan = Number.parseFloat(fTargetCloseMax)
    const raiseMaxMan = Number.parseFloat(fRaiseMax)
    return items.filter((p) => {
      if (key) {
        const hay = `${p.name} ${p.addr1}`.toLowerCase()
        if (!hay.includes(key)) return false
      }
      if (isFinite(areaMin) && areaMin > 0 && p.area < areaMin) return false
      if (isFinite(floorMin) && floorMin > 0) {
        const pf = (typeof p.floor === 'number') ? p.floor : -Infinity
        if (!(pf >= floorMin)) return false
      }
      if (fElev) {
        if (fElev === 'yes' && p.hasElev !== true) return false
        if (fElev === 'no' && p.hasElev !== false) return false
      }
      if (isFinite(buyMaxMan) && buyMaxMan > 0) {
        const max = buyMaxMan * 10000
        if (p.buyTarget > max) return false
      }
      if (isFinite(pastMinMaxMan) && pastMinMaxMan > 0) {
        const max = pastMinMaxMan * 10000
        if (p.pastMin > max) return false
      }
      if (isFinite(targetCloseMaxMan) && targetCloseMaxMan > 0) {
        const max = targetCloseMaxMan * 10000
        if (p.targetClose > max) return false
      }
      if (isFinite(raiseMaxMan) && raiseMaxMan > 0) {
        const max = raiseMaxMan * 10000
        if (p.raise > max) return false
      }
      return true
    })
  }, [items, fKey, fArea, fFloor, fElev, fBuyMax, fPastMinMax, fTargetCloseMax, fRaiseMax])

  // Card sorted
  const cardSorted = useMemo(() => {
    const arr = filtered.slice()
    arr.sort((a, b) => {
      const va = a[cardSortKey] as unknown as number
      const vb = b[cardSortKey] as unknown as number
      const r = (va ?? 0) - (vb ?? 0)
      return cardSortAsc ? r : -r
    })
    return arr
  }, [filtered, cardSortKey, cardSortAsc])

  // Table sorted
  const tableSorted = useMemo(() => {
    const arr = filtered.slice()
    arr.sort((a, b) => {
      const k: SortableKey = tableSortKey
      const va = a[k] as Item[SortableKey]
      const vb = b[k] as Item[SortableKey]
      if (typeof va === 'string' || typeof vb === 'string') {
        const r = String(va ?? '').localeCompare(String(vb ?? ''))
        return tableSortAsc ? r : -r
      }
      const na = Number(va ?? 0)
      const nb = Number(vb ?? 0)
      const r = na - nb
      return tableSortAsc ? r : -r
    })
    return arr
  }, [filtered, tableSortKey, tableSortAsc])

  function setCardSort(k: CardSortKey) {
    if (cardSortKey === k) setCardSortAsc(!cardSortAsc)
    else { setCardSortKey(k); setCardSortAsc(true) }
  }
  function setTableSort(k: SortableKey) { if (tableSortKey === k) setTableSortAsc(!tableSortAsc); else { setTableSortKey(k); setTableSortAsc(true) } }

  function judge(p: Item) {
    const diff = p.pastMin - p.buyTarget
    const near = Math.abs(diff) <= thGap
    const fast = p.pastMiniDays > 0 && p.pastMiniDays <= thDays
    const high = p.targetClose > p.pastMax && p.coefTotal >= thCoef
    const focus = near && fast
    return { diff, near, fast, high, focus }
  }

  function resetFilters() {
    setFKey(''); setFArea(''); setFFloor(''); setFElev('');
    setFBuyMax(''); setFPastMinMax(''); setFTargetCloseMax(''); setFRaiseMax('')
  }

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地交渉DX（Pattern 2 統合案）</h1>
            <span className="text-sm text-gray-500 hidden sm:inline">発見 → 理解 → 比較/整備 を単一UIで</span>
          </div>
          <div className="flex items-center gap-2"></div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
          <ul className="flex flex-wrap gap-2 text-sm">
            <li><button className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">一覧</button></li>
            <li><button className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</button></li>
            <li>
              <Link href="/sample/pattern_2_list/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">
                登録
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section id="tab-list" className="tab active">
          <div id="list-controls" className="mb-3 flex flex-wrap items-center gap-3">
            <div id="mode-toggle" className="inline-flex rounded-lg overflow-hidden border">
              <button id="mode-card" className={`px-3 py-1.5 text-sm ${viewMode==='card' ? 'bg-black text-white' : 'bg-white text-gray-700'}`} onClick={() => setViewMode('card')}>カード表示</button>
              <button id="mode-table" className={`px-3 py-1.5 text-sm ${viewMode==='table' ? 'bg-black text-white' : 'bg-white text-gray-700'}`} onClick={() => setViewMode('table')}>表表示</button>
            </div>
            <span className="text-sm text-gray-500">全<span id="countAll" className="num">{filtered.length}</span>件</span>
            <span className="flex-1"></span>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span className="badge badge-danger">差が小さい</span>
              <span className="badge badge-fast">日数が少ない</span>
              <span className="badge badge-warn">係数高い</span>
              <span className="badge badge-focus">要注目</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {/* Filters */}
            <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 space-y-4">
              <div className="flex items-center justify-between"><h2 className="font-semibold">フィルタ</h2><button className="text-sm text-gray-500" onClick={resetFilters}>リセット</button></div>
              <label className="block text-sm">キーワード（団地名/駅名/所在地）
                <input type="search" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例：湘南／藤沢本町／横浜 など" value={fKey} onChange={e=>setFKey(e.target.value)} />
              </label>
              {/* 駅徒歩/築年 フィルタは非表示（要件により削除） */}
              <label className="block text-sm">面積（㎡）以上
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="45" value={fArea} onChange={e=>setFArea(e.target.value)} />
              </label>
              <label className="block text-sm">階数（以上）
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="5" value={fFloor} onChange={e=>setFFloor(e.target.value)} />
              </label>
              <label className="block text-sm">エレベーター有無
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={fElev} onChange={e=>setFElev(e.target.value)}>
                  <option value="">指定なし</option>
                  <option value="yes">有</option>
                  <option value="no">無</option>
                </select>
              </label>
              <label className="block text-sm">買付目標額（万円）上限
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3000" value={fBuyMax} onChange={e=>setFBuyMax(e.target.value)} />
              </label>
              <label className="block text-sm">過去MIN（万円）上限
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3000" value={fPastMinMax} onChange={e=>setFPastMinMax(e.target.value)} />
              </label>
              <label className="block text-sm">目標成約額（万円）上限
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3000" value={fTargetCloseMax} onChange={e=>setFTargetCloseMax(e.target.value)} />
              </label>
              <label className="block text-sm">募集総額（万円）上限
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3000" value={fRaiseMax} onChange={e=>setFRaiseMax(e.target.value)} />
              </label>
              {/* バッジ基準（しきい値）エリアは削除 */}
              <button className="w-full bg-black text-white rounded-lg py-2 mt-2" onClick={(e)=>e.preventDefault()}>この条件で絞り込む</button>
            </aside>

            {/* Card List */}
            <section id="listCards" className={`md:col-span-3 bg-white rounded-2xl shadow overflow-hidden ${viewMode==='card' ? '' : 'hidden'}`}>
              <div className="border-b p-4 flex items-center justify-between text-sm text-gray-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span>並び替え：</span>
                  <button className="underline" onClick={() => setCardSort('unitPrice')}>単価（円/㎡）</button>
                  <button className="underline" onClick={() => setCardSort('buyTarget')}>買付目標額</button>
                  <button className="underline" onClick={() => setCardSort('pastMin')}>過去MIN</button>
                  <button className="underline" onClick={() => setCardSort('targetClose')}>目標成約額</button>
                  <button className="underline" onClick={() => setCardSort('raise')}>募集総額</button>
                  <button className="underline" onClick={() => setCardSort('pastMiniDays')}>過去MINI日数</button>
                  <button className="underline" onClick={() => setCardSort('coefTotal')}>係数計</button>
                </div>
                <div className="text-xs text-gray-400">{loading ? '読み込み中…' : msg}</div>
              </div>
              <div id="cardsContainer" className="divide-y">
                {cardSorted.map((p) => {
                  const j = judge(p)
                  const diffStr = (j.diff >= 0 ? '-' : '+') + Math.abs(j.diff).toLocaleString('ja-JP') + '円'
                  return (
                    <article key={p.id} className="p-4 grid md:grid-cols-12 gap-3 hover:bg-gray-50">
                      <div className="md:col-span-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap gap-1">
                            {j.near && <span className="badge badge-danger" title="過去MINと買付が接近">差が小さい</span>}
                            {j.fast && <span className="badge badge-fast" title="過去MINIの日数が少ない">日数が少ない</span>}
                            {j.high && <span className="badge badge-warn" title="過去MAXより高い目標成約＆係数高め">係数高い</span>}
                            {j.focus && <span className="badge badge-focus" title="差が小さく日数が少ない">要注目</span>}
                          </div>
                          <span className="font-medium text-blue-700">{p.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">{p.addr1}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {p.station && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{p.station}</span>}
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">面積 {sqm(p.area)}</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">単価 {p.unitPrice.toLocaleString('ja-JP')}円/㎡</span>
                        </div>
                      </div>
                      <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 text-sm">
                        <div><div className="text-gray-500">買付目標額</div><div className="font-semibold num whitespace-nowrap">{yen(p.buyTarget)}</div></div>
                        <div><div className="text-gray-500">過去MIN</div><div className="font-semibold num whitespace-nowrap">{yen(p.pastMin)}</div></div>
                        <div><div className="text-gray-500">目標成約額</div><div className="font-semibold num whitespace-nowrap">{yen(p.targetClose)}</div></div>
                        <div><div className="text-gray-500">募集総額</div><div className="font-semibold num whitespace-nowrap">{yen(p.raise)}</div></div>
                        <div className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5">
                          <div className="text-violet-700 text-xs">過去MINI日数</div>
                          <div className="font-semibold num text-base text-violet-800 whitespace-nowrap">{p.pastMiniDays}日</div>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                          <div className="text-amber-700 text-xs">係数計</div>
                          <div className="font-semibold num text-base text-amber-800 whitespace-nowrap">{p.coefTotal.toFixed(2)}</div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Table List */}
            <section id="listTable" className={`md:col-span-3 bg-white rounded-2xl shadow overflow-auto ${viewMode==='table' ? '' : 'hidden'}`}>
              <div className="border-b p-3 text-sm text-gray-600">列ヘッダをクリックでソート</div>
              <div className="p-3">
                <table className="grid min-w-full text-sm text-left text-gray-800">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('id')}>NO</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('name')}>団地名</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold">所在地</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold">最寄</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('walk')}>徒歩</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('built')}>築年</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('area')}>面積(㎡)</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('listPrice')}>売出価格</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('unitPrice')}>単価(円/㎡)</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('coefTotal')}>係数計</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('targetClose')}>目標成約</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('raise')}>募集総額</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('buyTarget')}>買付目標</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('pastMin')}>過去MIN</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('pastMax')}>過去MAX</th>
                      <th className="px-3 py-2 bg-gray-50 font-semibold sortable" onClick={()=>setTableSort('pastMiniDays')}>過去MINI日数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableSorted.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{p.id}</td>
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2">{p.addr1}</td>
                        <td className="px-3 py-2">{p.station}</td>
                        <td className="px-3 py-2 num">{p.walk ?? '-'}</td>
                        <td className="px-3 py-2 num">{p.built ?? '-'}</td>
                        <td className="px-3 py-2 num">{p.area.toFixed(2)}</td>
                        <td className="px-3 py-2 num">{p.listPrice.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.unitPrice.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.coefTotal.toFixed(2)}</td>
                        <td className="px-3 py-2 num">{p.targetClose.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.raise.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.buyTarget.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.pastMin.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.pastMax.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-2 num">{p.pastMiniDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </main>
      <style jsx global>{`
        .tab { display: none; }
        .tab.active { display: block; }
        .num { font-variant-numeric: tabular-nums; }
        .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:9999px;font-size:11px;line-height:1;border:1px solid transparent;white-space:nowrap}
        .badge-danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}
        .badge-fast{background:#ede9fe;color:#5b21b6;border-color:#ddd6fe}
        .badge-warn{background:#fef3c7;color:#92400e;border-color:#fde68a}
        .badge-focus{background:#dcfce7;color:#065f46;border-color:#bbf7d0;font-weight:600}
        @media print { header, nav, #list-controls, #mode-toggle { display:none !important; } .rounded-2xl { border-radius: 0.5rem; } }
        table.grid { border-collapse: collapse; }
        table.grid th, table.grid td { border: 1px solid #e5e7eb; white-space: nowrap; }
        table.grid tbody tr:nth-child(even) td { background: #fafafa; }
        th.sortable { cursor: pointer; user-select: none; }
        .sort-ind { font-size: 11px; color:#6b7280; margin-left:.25rem; }
      `}</style>
    </div>
  )
}
