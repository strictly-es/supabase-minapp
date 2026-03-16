'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildDetailSummary } from '@/lib/detailSummary'
import { softDeleteEntry } from '@/lib/repositories/entries'
import { softDeleteStock } from '@/lib/repositories/stocks'
import { getSupabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import UserEmail from '@/components/UserEmail'
import RequireAuth from '@/components/RequireAuth'
import DetailKpiCards from './DetailKpiCards'
import DetailMetricsSection from './DetailMetricsSection'
import DetailOverviewSection from './DetailOverviewSection'
import DetailStocksSection from './DetailStocksSection'
import type { DetailRow as Row, DetailStock as Stock } from './detailShared'

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
      await softDeleteEntry(supabase, id, user?.id)
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
    return buildDetailSummary(row)
  }, [row])

  async function handleDeleteStock(stockId: string) {
    if (!window.confirm('この在庫を削除します。よろしいですか？')) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await softDeleteStock(supabase, stockId, user?.id)
      setStocks((prev) => prev.filter((item) => item.id !== stockId))
    } catch (e) {
      console.error('[stock:delete:error]', e)
      setMsg('在庫の削除に失敗しました')
    }
  }

  return (
    <RequireAuth>
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地レボリューション(デモ)</h1>
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

            <DetailKpiCards computed={computed} />

            <DetailOverviewSection row={row} computed={computed} signedUrl={signedUrl} />

            <DetailMetricsSection row={row} computed={computed} />

            <DetailStocksSection detailId={id} stocks={stocks} onDeleteStock={(stockId) => { handleDeleteStock(stockId).catch(console.error) }} />

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
