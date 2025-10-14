'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

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
  status: '問い合わせ' | '内見' | '収支検討' | '買付' | '契約締結' | '引き渡し' | null
}

type FormState = {
  floor: string
  area_sqm: string
  list_price: string
  registered_date: string
  broker_name: string
  broker_pref: string
  broker_city: string
  broker_town: string
  broker_tel: string
  broker_person: string
  broker_mobile: string
  broker_email: string
  broker_mysoku_url: string
  broker_photo_url: string
  fundplan_url: string
  status: '問い合わせ' | '内見' | '収支検討' | '買付' | '契約締結' | '引き渡し'
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

  const [row, setRow] = useState<Stock | null>(null)
  const [form, setForm] = useState<FormState>({
    floor: '', area_sqm: '', list_price: '', registered_date: '',
    broker_name: '', broker_pref: '', broker_city: '', broker_town: '', broker_tel: '', broker_person: '', broker_mobile: '', broker_email: '', broker_mysoku_url: '', broker_photo_url: '', fundplan_url: '', status: '問い合わせ'
  })
  const [pdf, setPdf] = useState<File | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!stockId) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('estate_stocks')
          .select('id, estate_entry_id, floor, area_sqm, list_price, registered_date, stock_mysoku_path, broker_name, broker_pref, broker_city, broker_town, broker_tel, broker_person, broker_mobile, broker_email, broker_mysoku_url, broker_photo_url, fundplan_url, status')
          .eq('id', stockId)
          .maybeSingle()
        if (error) throw error
        const s = (data ?? null) as Stock | null
        if (mounted) {
          setRow(s)
          if (s) {
            setForm({
              floor: (typeof s.floor === 'number' ? String(s.floor) : ''),
              area_sqm: (typeof s.area_sqm === 'number' ? String(s.area_sqm) : ''),
              list_price: (typeof s.list_price === 'number' ? String(s.list_price) : ''),
              registered_date: s.registered_date ?? '',
              broker_name: s.broker_name ?? '',
              broker_pref: s.broker_pref ?? '',
              broker_city: s.broker_city ?? '',
              broker_town: s.broker_town ?? '',
              broker_tel: s.broker_tel ?? '',
              broker_person: s.broker_person ?? '',
              broker_mobile: s.broker_mobile ?? '',
              broker_email: s.broker_email ?? '',
              broker_mysoku_url: s.broker_mysoku_url ?? '',
              broker_photo_url: s.broker_photo_url ?? '',
              fundplan_url: s.fundplan_url ?? '',
              status: (s.status as FormState['status']) || '問い合わせ',
            })
            if (s.stock_mysoku_path) {
              const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(s.stock_mysoku_path, 600)
              if (mounted) setSignedUrl(signed?.signedUrl ?? null)
            }
          }
        }
      } catch (e) {
        console.error('[stock:edit:load]', e)
        if (mounted) setMsg('読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, stockId])

  const onChange = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value as FormState[K] }))
  }

  const derived = useMemo(() => {
    const area = parseFloat(form.area_sqm || '0')
    const price = parseFloat(form.list_price || '0')
    const unit = isFinite(area) && area > 0 && isFinite(price) ? Math.round(price / area) : NaN
    return { unit }
  }, [form.area_sqm, form.list_price])

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!stockId) return
    setMsg('更新中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); return }

      const toInt = (v: string): number | null => v.trim() === '' ? null : Number.parseInt(v, 10)
      const toNum = (v: string): number | null => v.trim() === '' ? null : Number.parseFloat(v)

      let stock_mysoku_path: string | null | undefined = undefined
      if (pdf) {
        const sanitized = pdf.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
        const path = `${user.id}/stock/${Date.now()}-${sanitized}`
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, pdf, { upsert: false, contentType: 'application/pdf' })
        if (upErr) { setMsg('PDFアップロード失敗: ' + upErr.message); return }
        stock_mysoku_path = path
      }

      const payload: Record<string, unknown> = {
        floor: toInt(form.floor),
        area_sqm: toNum(form.area_sqm),
        list_price: toInt(form.list_price),
        registered_date: form.registered_date || null,
        broker_name: form.broker_name || null,
        broker_pref: form.broker_pref || null,
        broker_city: form.broker_city || null,
        broker_town: form.broker_town || null,
        broker_tel: form.broker_tel || null,
        broker_person: form.broker_person || null,
        broker_mobile: form.broker_mobile || null,
        broker_email: form.broker_email || null,
        broker_mysoku_url: form.broker_mysoku_url || null,
        broker_photo_url: form.broker_photo_url || null,
        fundplan_url: form.fundplan_url || null,
        status: form.status,
      }
      if (typeof stock_mysoku_path !== 'undefined') payload.stock_mysoku_path = stock_mysoku_path

      const { error: upErr } = await supabase
        .from('estate_stocks')
        .update(payload)
        .eq('id', stockId)

      if (upErr) { setMsg('DB更新失敗: ' + upErr.message); return }

      setMsg('更新しました。詳細に戻ります...')
      if (row?.estate_entry_id) router.push(`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`)
      else router.push('/sample/pattern_2_list/tab-list')
    } catch (e) {
      console.error('[stock:edit:update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    }
  }

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
            {row?.estate_entry_id && (
              <li><Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</Link></li>
            )}
            <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">在庫編集</span></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {row?.estate_entry_id ? (
                <Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 戻る</Link>
              ) : (
                <Link href="/sample/pattern_2_list/tab-list" className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 一覧へ</Link>
              )}
              <h2 className="text-lg font-semibold">在庫編集</h2>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : !row ? (
            <p className="text-sm text-red-600">データが見つかりませんでした</p>
          ) : (
            <form onSubmit={(e) => { handleSubmit(e).catch(console.error) }} className="space-y-6">
              <section className="space-y-4">
                <h3 className="font-semibold">物件情報</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block">階数（入力）
                    <input type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="5"
                      value={form.floor} onChange={onChange('floor')} />
                  </label>
                  <label className="block">m²数
                    <input type="number" min={0} step={0.01} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="55.20"
                      value={form.area_sqm} onChange={onChange('area_sqm')} />
                  </label>
                  <label className="block">販売価格
                    <input type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="12800000"
                      value={form.list_price} onChange={onChange('list_price')} required />
                  </label>
                  <div className="block"><div className="text-gray-500">m²単価</div><div className="mt-1 font-semibold tabular-nums">{isNaN(derived.unit) ? '-' : `${derived.unit.toLocaleString('ja-JP')} 円/㎡`}</div></div>
                  <label className="block">登録年月日
                    <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.registered_date} onChange={onChange('registered_date')} />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">仲介不動産会社の情報</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block">社名<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_name} onChange={onChange('broker_name')} /></label>
                  <label className="block">所在地（都道府県）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_pref} onChange={onChange('broker_pref')} /></label>
                  <label className="block">所在地（市）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_city} onChange={onChange('broker_city')} /></label>
                  <label className="block md:col-span-3">所在地（町村）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_town} onChange={onChange('broker_town')} /></label>
                  <label className="block">TEL<input type="tel" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_tel} onChange={onChange('broker_tel')} /></label>
                  <label className="block">担当者名<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_person} onChange={onChange('broker_person')} /></label>
                  <label className="block">携帯<input type="tel" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_mobile} onChange={onChange('broker_mobile')} /></label>
                  <label className="block md:col-span-2">メールアドレス<input type="email" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_email} onChange={onChange('broker_email')} /></label>
                  <label className="block md:col-span-3">マイソクPDF（置換可）
                    <div className="mt-1 flex items-center gap-3">
                      {signedUrl && <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">確認</a>}
                      <input id="mysoku" type="file" accept="application/pdf" className="w-full border rounded-lg px-3 py-2" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                    </div>
                  </label>
                  <label className="block md:col-span-3">マイソクURL<input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_mysoku_url} onChange={onChange('broker_mysoku_url')} /></label>
                  <label className="block md:col-span-3">現地写真URL<input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.broker_photo_url} onChange={onChange('broker_photo_url')} /></label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">ファンド収支事業計画</h3>
                <label className="block text-sm">エクセルURL<input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="https://...xlsx" value={form.fundplan_url} onChange={onChange('fundplan_url')} /></label>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">ステータス</h3>
                <select className="w-full md:w-60 border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={onChange('status')}>
                  <option value="問い合わせ">問い合わせ</option>
                  <option value="内見">内見</option>
                  <option value="収支検討">収支検討</option>
                  <option value="買付">買付</option>
                  <option value="契約締結">契約締結</option>
                  <option value="引き渡し">引き渡し</option>
                </select>
              </section>

              <div className="flex items-center justify-end gap-2">
                {row?.estate_entry_id ? (
                  <Link href={`/sample/pattern_2_list/tab-detail/${row.estate_entry_id}`} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">キャンセル</Link>
                ) : (
                  <Link href="/sample/pattern_2_list/tab-list" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">キャンセル</Link>
                )}
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white text-sm">保存</button>
              </div>
              <p className="text-xs text-gray-600">{msg}</p>
            </form>
          )}
        </div>
      </main>
      <style jsx global>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
    </RequireAuth>
  )
}
