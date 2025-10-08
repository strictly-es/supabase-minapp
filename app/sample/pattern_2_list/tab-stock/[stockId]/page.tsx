'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'

type Stock = {
  id: string
  estate_entry_id: string
  floor: number | null
  area_sqm: number | null
  list_price: number | null
  registered_date: string | null
  stock_mysoku_path: string | null
  broker_name: string | null
  broker_pref: string | null
  broker_city: string | null
  broker_town: string | null
  broker_tel: string | null
  broker_person: string | null
  broker_mobile: string | null
  broker_email: string | null
  broker_mysoku_url: string | null
  broker_photo_url: string | null
  fundplan_url: string | null
  status: string | null
}

function yen(n: number): string { return n.toLocaleString('ja-JP') }
function parseDate(s: string | null): string { if (!s) return '-'; const d = new Date(s); return isNaN(+d) ? '-' : d.toLocaleDateString('ja-JP') }

export default function StockDetailPage() {
  const supabase = getSupabase()
  const params = useParams<{ stockId: string }>()
  const stockId = params?.stockId as string | undefined

  const [row, setRow] = useState<Stock | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        if (!stockId) return
        const { data, error } = await supabase
          .from('estate_stocks')
          .select('id, estate_entry_id, floor, area_sqm, list_price, registered_date, stock_mysoku_path, broker_name, broker_pref, broker_city, broker_town, broker_tel, broker_person, broker_mobile, broker_email, broker_mysoku_url, broker_photo_url, fundplan_url, status')
          .eq('id', stockId)
          .maybeSingle()
        if (error) throw error
        const s = (data ?? null) as Stock | null
        if (mounted) setRow(s)
        if (s?.stock_mysoku_path) {
          const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(s.stock_mysoku_path, 600)
          if (mounted) setSignedUrl(signed?.signedUrl ?? null)
        }
      } catch (e: unknown) {
        console.error(e)
        if (mounted) setMsg('読み込みに失敗しました')
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, stockId])

  const derived = useMemo(() => {
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
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地交渉DX（在庫詳細）</h1>
          </div>
          <div className="flex items-center gap-2" />
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
          <ul className="flex flex-wrap gap-2 text-sm">
            {row?.estate_entry_id && (
              <li><Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</Link></li>
            )}
            <li><Link href="/sample/pattern_2_list/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section className="tab active">
          <div className="bg-white rounded-2xl shadow p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {row?.estate_entry_id ? (
                  <Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 詳細へ</Link>
                ) : (
                  <Link href="/sample/pattern_2_list/tab-list" className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 一覧へ</Link>
                )}
                <h2 className="text-lg font-semibold">販売中物件 詳細</h2>
              </div>
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold">物件情報</h3>
              <dl className="grid md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <div><dt className="text-gray-500">階数</dt><dd>{row?.floor ?? '-'}</dd></div>
                <div><dt className="text-gray-500">m²数</dt><dd className="num">{typeof row?.area_sqm === 'number' ? row.area_sqm.toFixed(2) : '-'}</dd></div>
                <div><dt className="text-gray-500">販売価格</dt><dd className="num">{typeof row?.list_price === 'number' ? yen(row.list_price) : '-'}</dd></div>
                <div><dt className="text-gray-500">m²単価</dt><dd className="num">{derived && !isNaN(derived.unit) ? `${derived.unit.toLocaleString('ja-JP')}` : '-'}</dd></div>
                <div><dt className="text-gray-500">登録年月日</dt><dd>{parseDate(row?.registered_date ?? null)}</dd></div>
                <div><dt className="text-gray-500">経過日数</dt><dd>{derived?.elapsed ?? '-'}</dd></div>
              </dl>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">仲介不動産会社の情報</h3>
              <dl className="grid md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <div><dt className="text-gray-500">社名</dt><dd>{row?.broker_name || '-'}</dd></div>
                <div><dt className="text-gray-500">所在地（都道府県）</dt><dd>{row?.broker_pref || '-'}</dd></div>
                <div><dt className="text-gray-500">所在地（市）</dt><dd>{row?.broker_city || '-'}</dd></div>
                <div className="md:col-span-3"><dt className="text-gray-500">所在地（町村）</dt><dd>{row?.broker_town || '-'}</dd></div>
                <div><dt className="text-gray-500">TEL</dt><dd>{row?.broker_tel || '-'}</dd></div>
                <div><dt className="text-gray-500">担当者名</dt><dd>{row?.broker_person || '-'}</dd></div>
                <div><dt className="text-gray-500">携帯</dt><dd>{row?.broker_mobile || '-'}</dd></div>
                <div className="md:col-span-2"><dt className="text-gray-500">メールアドレス</dt><dd>{row?.broker_email || '-'}</dd></div>
                <div><dt className="text-gray-500">マイソクPDF</dt><dd>{row?.broker_mysoku_url ? <a href={row.broker_mysoku_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : (signedUrl ? <a href={signedUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く（Storage）</a> : <span className="text-gray-400">-</span>)}</dd></div>
                <div><dt className="text-gray-500">現地写真</dt><dd>{row?.broker_photo_url ? <a href={row.broker_photo_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : <span className="text-gray-400">-</span>}</dd></div>
              </dl>
            </section>

            

            <section className="space-y-4">
              <h3 className="font-semibold">ファンド収支事業計画</h3>
              <div className="text-sm">{row?.fundplan_url ? <a href={row.fundplan_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : <span className="text-gray-400">-</span>}</div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">ステータス</h3>
              <div className="text-sm">{row?.status || '-'}</div>
            </section>

            <div className="flex items-center justify-end gap-2">
              {row?.estate_entry_id ? (
                <Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">詳細に戻る</Link>
              ) : (
                <Link href="/sample/pattern_2_list/tab-list" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">一覧へ</Link>
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
  )
}
