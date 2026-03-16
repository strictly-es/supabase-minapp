'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createStockPdfSignedUrl, loadStockDetail, softDeleteStock, type StockDetailRow } from '@/lib/repositories/stocks'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import StockBrokerSection from './StockBrokerSection'
import StockLinksSection from './StockLinksSection'
import StockPropertySection from './StockPropertySection'
import type { StockDerived } from './stockDetailShared'

function yen(n: number): string { return n.toLocaleString('ja-JP') }
function parseDate(s: string | null): string { if (!s) return '-'; const d = new Date(s); return isNaN(+d) ? '-' : d.toLocaleDateString('ja-JP') }

export default function StockDetailPage() {
  const supabase = getSupabase()
  const params = useParams<{ stockId: string }>()
  const stockId = params?.stockId as string | undefined

  const [row, setRow] = useState<StockDetailRow | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>('')

  async function handleDelete() {
    if (!stockId) return
    const ok = window.confirm('この在庫を削除します。よろしいですか？')
    if (!ok) return
    setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      await softDeleteStock(supabase, stockId, user?.id)
      setMsg('削除しました。移動します...')
      if (row?.estate_entry_id) window.location.href = `/tab-detail/${row.estate_entry_id}`
      else window.location.href = '/tab-list'
    } catch (e) {
      console.error('[stock:detail:delete]', e)
      setMsg('削除に失敗しました')
    }
  }

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        if (!stockId) return
        const s = await loadStockDetail(supabase, stockId)
        if (mounted) setRow(s)
        if (s?.stock_mysoku_path) {
          const url = await createStockPdfSignedUrl(supabase, s.stock_mysoku_path)
          if (mounted) setSignedUrl(url)
        }
      } catch (e: unknown) {
        console.error(e)
        if (mounted) setMsg('読み込みに失敗しました')
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, stockId])

  const derived = useMemo<StockDerived | null>(() => {
    if (!row) return null
    const area = typeof row.area_sqm === 'number' ? row.area_sqm : NaN
    const price = typeof row.list_price === 'number' ? row.list_price : NaN
    const unit = isFinite(area) && area > 0 && isFinite(price) ? Math.round(price / area) : NaN
    let elapsed: string = '-'
    const d = row.registered_date
    if (d) {
      const dt = new Date(d)
      if (!isNaN(+dt)) {
        const today = new Date()
        const days = Math.max(0, Math.round((+today - +dt) / 86400000))
        elapsed = `${days}日`
      }
    }
    return { unit, elapsed }
  }, [row])

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
            {row?.estate_entry_id && (
              <li><Link href={`/tab-detail/${row.estate_entry_id}`} className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</Link></li>
            )}
            <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section className="tab active">
          <div className="bg-white rounded-2xl shadow p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {row?.estate_entry_id ? (
                  <Link href={`/tab-detail/${row.estate_entry_id}`} className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 詳細へ</Link>
                ) : (
                  <Link href="/tab-list" className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 一覧へ</Link>
                )}
                <h2 className="text-lg font-semibold">販売中物件 詳細</h2>
              </div>
              <div className="flex items-center gap-2">
                {stockId && (
                  <Link href={`/tab-stock/${stockId}/edit`} className="px-3 py-1.5 rounded-lg bg-black text-white text-sm">編集</Link>
                )}
                <button onClick={() => { handleDelete().catch(console.error) }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">削除</button>
              </div>
            </div>

            <StockPropertySection row={row} derived={derived} parseDate={parseDate} yen={yen} />

            <StockBrokerSection row={row} signedUrl={signedUrl} />

            <StockLinksSection row={row} />

            <div className="flex items-center justify-end gap-2">
              {row?.estate_entry_id ? (
                <Link href={`/tab-detail/${row.estate_entry_id}`} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">詳細に戻る</Link>
              ) : (
                <Link href="/tab-list" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">一覧へ</Link>
              )}
            </div>

            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        </section>
      </main>
      <style jsx global>{`
        .num { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
    </RequireAuth>
  )
}
