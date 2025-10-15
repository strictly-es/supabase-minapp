'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import UserEmail from '@/components/UserEmail'
import RequireAuth from '@/components/RequireAuth'

type Row = {
  id: string
  estate_name: string | null
  management: string | null
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
  mysoku_pdf_path: string | null
  interior_level_coef: number | null
  contract_year_coef: number | null
}

type Stock = {
  id: string
  floor: number | null
  area_sqm: number | null
  list_price: number | null
  registered_date: string | null
}

function safeNum(n: number | null | undefined, d = 0): number { return (typeof n === 'number' && isFinite(n)) ? n : d }
function parseDate(s: string | null): string { if (!s) return '-'; const d = new Date(s); return isNaN(+d) ? '-' : d.toLocaleDateString('ja-JP') }
function yen(n: number): string { return n.toLocaleString('ja-JP') }

export default function DetailPage() {
  const supabase = getSupabase()
  const params = useParams<{ id: string }>()
  const id = params?.id as string | undefined
  const [row, setRow] = useState<Row | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>('')
  const [stocks, setStocks] = useState<Stock[]>([])

  async function handleDelete() {
    if (!id) return
    const ok = window.confirm('この物件を削除します。よろしいですか？')
    if (!ok) return
    setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      const payload: Record<string, unknown> = { deleted_at: new Date().toISOString() }
      if (user?.id) payload.deleted_by = user.id
      const { error } = await supabase
        .from('estate_entries')
        .update(payload)
        .eq('id', id)
      if (error) throw error
      setMsg('削除しました。一覧へ移動します...')
      window.location.href = '/tab-list'
    } catch (e) {
      console.error('[detail:delete:error]', e)
      setMsg('削除に失敗しました')
    }
  }

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!id) return
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, estate_name, management, addr1, addr2, max_price, area_sqm, coef_total, past_min, reins_registered_date, contract_date, floor, has_elevator, mysoku_pdf_path, interior_level_coef, contract_year_coef')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (mounted) setRow((data ?? null) as Row | null)

        const path = (data as Row | null)?.mysoku_pdf_path ?? null
        if (path) {
          const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(path, 600)
          if (mounted) setSignedUrl(signed?.signedUrl ?? null)
        }
        // fetch current on-sale stocks for this entry
        const { data: sData, error: sErr } = await supabase
          .from('estate_stocks')
          .select('id, floor, area_sqm, list_price, registered_date')
          .eq('estate_entry_id', id)
          .is('deleted_at', null)
          .order('registered_date', { ascending: false })
        if (sErr) throw sErr
        if (mounted) setStocks((sData ?? []) as Stock[])
      } catch (e: unknown) {
        console.error(e)
        if (mounted) setMsg('読み込みに失敗しました')
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, id])

  const computed = useMemo(() => {
    if (!row) return null
    const name = (row.estate_name ?? '').trim() || '(名称未設定)'
    const addr = [row.addr1 ?? '', row.addr2 ?? ''].filter(Boolean).join(' ')
    const area = safeNum(row.area_sqm, 0)
    const pastMax = safeNum(row.max_price, 0)
    const unit = area > 0 ? Math.round(pastMax / area) : 0
    const coef = safeNum(row.coef_total, 1)
    const targetClose = Math.round(unit * area * coef)
    const raise = Math.floor((targetClose / 1.21) / 10000) * 10000
    const pastMin = safeNum(row.past_min, 0)
    const interior = safeNum(row.interior_level_coef, 0)
    const yearCoef = safeNum(row.contract_year_coef, 0)
    const coefSum = interior + yearCoef
    // 買付目標額（一覧の計算式に合わせる）
    const moveCost = area < 60 ? Math.round(area * 132000) : (area >= 80 ? Math.round(area * 123000) : Math.round(area * (132000 - (area - 60) * 400)))
    const brokerage = raise < 10_000_000 ? 550_000 : Math.round(raise * 0.055)
    const other = Math.round(raise * 0.075)
    const buyTarget = raise - moveCost - brokerage - other
    return { name, addr, area, unit, targetClose, raise, pastMin, interior, yearCoef, coefSum, buyTarget }
  }, [row])

  return (
    <RequireAuth>
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地交渉DX（デモ）</h1>
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
            <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">詳細</span></li>
            <li><Link href="/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">登録</Link></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section className="tab active">
          <div className="bg-white rounded-2xl shadow p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/tab-list" className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 一覧へ</Link>
                <h2 className="text-lg font-semibold">物件詳細</h2>
              </div>
              <div className="flex items-center gap-2">
                {id && (
                  <Link href={`/tab-detail/${id}/edit`} className="px-3 py-1.5 rounded-lg bg-black text-white text-sm">
                    編集
                  </Link>
                )}
                <button onClick={() => { handleDelete().catch(console.error) }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">
                  削除
                </button>
              </div>
            </div>

            {/* KPI cards */}
            <section className="grid md:grid-cols-5 gap-3">
              <div className="rounded-2xl bg-lime-50 p-4"><div className="text-xs text-gray-500">㎡単価</div><div className="text-2xl font-semibold"><span className="num">{computed ? yen(computed.unit) : '-'}</span><span className="text-sm"> 円/㎡</span></div></div>
              <div className="rounded-2xl bg-indigo-50 p-4"><div className="text-xs text-gray-500">目標成約価格</div><div className="text-2xl font-semibold"><span className="num">{computed ? yen(computed.targetClose) : '-'}</span><span className="text-sm"> 円</span></div></div>
              <div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs text-gray-500">募集総額</div><div className="text-2xl font-semibold"><span className="num">{computed ? yen(computed.raise) : '-'}</span><span className="text-sm"> 円</span></div></div>
              <div className="rounded-2xl bg-rose-50 p-4"><div className="text-xs text-gray-500">過去MIN（令和）</div><div className="text-2xl font-semibold"><span className="num">{computed ? yen(computed.pastMin) : '-'}</span><span className="text-sm"> 円</span></div></div>
              <div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs text-gray-500">買付目標額</div><div className="text-2xl font-semibold"><span className="num">{computed ? yen(computed.buyTarget) : '-'}</span><span className="text-sm"> 円</span></div></div>
            </section>

            {/* 詳細（拡張） */}
            <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold">詳細</h3>
              <dl className="grid md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div><dt className="text-gray-500">団地名</dt><dd className="font-medium">{computed?.name ?? '-'}</dd></div>
                <div><dt className="text-gray-500">所在地（都道府県/市/町村）</dt><dd>{computed?.addr || '-'}</dd></div>
                <div><dt className="text-gray-500">管理</dt><dd>{row?.management || '-'}</dd></div>
                <div><dt className="text-gray-500">階数（入力）</dt><dd className="num">{row?.floor ?? '-'}</dd></div>
                <div><dt className="text-gray-500">エレベーター有無</dt><dd>{row?.has_elevator === true ? '有' : row?.has_elevator === false ? '無' : '-'}</dd></div>
                <div><dt className="text-gray-500">面積（㎡）</dt><dd className="num">{computed ? computed.area.toFixed(2) : '-'}</dd></div>
                <div><dt className="text-gray-500">㎡単価（成約/㎡）</dt><dd className="num">{computed ? yen(computed.unit) : '-'}</dd></div>
                <div><dt className="text-gray-500">登録年月日</dt><dd>{parseDate(row?.reins_registered_date ?? null)}</dd></div>
                <div><dt className="text-gray-500">成約年月日</dt><dd>{parseDate(row?.contract_date ?? null)}</dd></div>
                <div><dt className="text-gray-500">添付（マイソクPDF）</dt><dd>{signedUrl ? <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">確認</a> : '-'}</dd></div>
              </dl>
            </section>

            {/* 係数 */}
            <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold">係数</h3>
              <dl className="grid md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                <div><dt className="text-gray-500">内装レベル 係数</dt><dd className="num">{computed ? computed.interior.toFixed(2) : '-'}</dd></div>
                <div><dt className="text-gray-500">成約年数 上乗せ係数</dt><dd className="num">{computed ? computed.yearCoef.toFixed(2) : '-'}</dd></div>
                <div><dt className="text-gray-500">係数計</dt><dd className="num">{typeof row?.coef_total === 'number' ? row.coef_total.toFixed(2) : '-'}</dd></div>
              </dl>
            </section>

            {/* 買付目標額（参考） */}
            <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold">買付目標額（参考）</h3>
              <dl className="grid md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <dt className="text-gray-500">買付目標額 × 0.9</dt>
                  <dd className="num">{computed ? yen(Math.round(computed.buyTarget * 0.9)) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">買付目標額 × 1.25</dt>
                  <dd className="num">{computed ? yen(Math.round(computed.buyTarget * 1.25)) : '-'}</dd>
                </div>
              </dl>
            </section>

            {/* 現在販売中の在庫物件 */}
            <section className="rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">現在販売中の在庫物件</h3>
                <Link href={`/tab-stock-reg?entryId=${id ?? ''}`} className="px-2 py-1 rounded bg-gray-100 text-sm">在庫登録</Link>
              </div>
              {stocks.length === 0 ? (
                <p className="text-sm text-gray-500">現在販売中の在庫はありません</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {stocks.map((s) => (
                    <li key={s.id}>
                      {typeof s.floor === 'number' ? `${s.floor}階` : '-'}、{typeof s.area_sqm === 'number' ? `${s.area_sqm.toFixed(2)}m²` : '-'} 、販売価格 {typeof s.list_price === 'number' ? `${yen(s.list_price)}円` : '-'}
                      {' '}
                      <Link href={`/tab-stock/${s.id}`} className="text-blue-600 underline">詳細</Link>
                      {' '}
                      <Link href={`/tab-stock/${s.id}/edit`} className="text-blue-600 underline">編集</Link>
                      {' '}
                      <button
                        className="text-red-600 underline"
                        onClick={async () => {
                          if (!window.confirm('この在庫を削除します。よろしいですか？')) return
                          try {
                            const { data: { user } } = await supabase.auth.getUser()
                            const payload: Record<string, unknown> = { deleted_at: new Date().toISOString() }
                            if (user?.id) payload.deleted_by = user.id
                            const { error: delErr } = await supabase
                              .from('estate_stocks')
                              .update(payload)
                              .eq('id', s.id)
                            if (delErr) throw delErr
                            setStocks(prev => prev.filter(p => p.id !== s.id))
                          } catch (e) {
                            console.error('[stock:delete:error]', e)
                            setMsg('在庫の削除に失敗しました')
                          }
                        }}
                      >削除</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        </section>
      </main>

      <style jsx global>{`
        .tab { display: block; }
        .num { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
    </RequireAuth>
  )
}
