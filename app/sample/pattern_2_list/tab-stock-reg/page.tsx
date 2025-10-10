'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Entry = { id: string; estate_name: string | null; past_min: number | null }

type FormState = {
  estate_entry_id: string
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

export default function StockRegPage() {
  const supabase = getSupabase()

  const [entries, setEntries] = useState<Entry[]>([])
  const [form, setForm] = useState<FormState>({
    estate_entry_id: '',
    floor: '',
    area_sqm: '',
    list_price: '',
    registered_date: '',
    broker_name: '',
    broker_pref: '',
    broker_city: '',
    broker_town: '',
    broker_tel: '',
    broker_person: '',
    broker_mobile: '',
    broker_email: '',
    broker_mysoku_url: '',
    broker_photo_url: '',
    fundplan_url: '',
    status: '問い合わせ',
  })
  const [pdf, setPdf] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  // load estate entries for selection
  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, estate_name, past_min')
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) throw error
        const list = (data ?? []) as Entry[]
        if (mounted) setEntries(list)
        // プリセレクト（遷移元が指定した場合）
        const qsId = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('entryId') || '') : ''
        if (mounted && qsId && !form.estate_entry_id) {
          const exists = list.some((e: Entry) => e.id === qsId)
          if (exists) setForm(prev => ({ ...prev, estate_entry_id: qsId }))
        }
      } catch (e) {
        console.error(e)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, form.estate_entry_id])

  // derived display values
  const derived = useMemo(() => {
    const area = parseFloat(form.area_sqm || '0')
    const price = parseFloat(form.list_price || '0')
    const unit = isFinite(area) && area > 0 && isFinite(price) ? Math.round(price / area) : NaN
    const selected = entries.find(e => e.id === form.estate_entry_id) || null
    const pmin = selected?.past_min ?? null
    const diff = isFinite(price) && typeof pmin === 'number' ? price - pmin : NaN
    const dateStr = form.registered_date
    let elapsed: string = '-'
    if (dateStr) {
      const dt = new Date(dateStr)
      if (!isNaN(+dt)) {
        const today = new Date()
        const days = Math.max(0, Math.round((+today - +dt) / 86400000))
        elapsed = `${days}日`
      }
    }
    return { unit, diff, elapsed }
  }, [form.area_sqm, form.list_price, form.registered_date, form.estate_entry_id, entries])

  const onChange = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value as unknown as FormState[K] }))
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setMsg('保存中...')
    setSubmitting(true)
    try {
      // auth
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); setSubmitting(false); return }

      if (!form.estate_entry_id) { setMsg('親の過去成約（estate_entries）を選択してください'); setSubmitting(false); return }
      if (!form.list_price || isNaN(parseFloat(form.list_price))) { setMsg('販売価格を入力してください'); setSubmitting(false); return }

      const toInt = (v: string): number | null => v.trim() === '' ? null : Number.parseInt(v, 10)
      const toNum = (v: string): number | null => v.trim() === '' ? null : Number.parseFloat(v)

      // upload pdf if any
      let stock_mysoku_path: string | null = null
      if (pdf) {
        const sanitized = pdf.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
        const path = `${user.id}/stock/${Date.now()}-${sanitized}`
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, pdf, { upsert: false, contentType: 'application/pdf' })
        if (upErr) { setMsg('PDFアップロード失敗: ' + upErr.message); setSubmitting(false); return }
        stock_mysoku_path = path
      }

      const payload = {
        created_by: user.id,
        estate_entry_id: form.estate_entry_id,
        floor: toInt(form.floor),
        area_sqm: toNum(form.area_sqm),
        list_price: toInt(form.list_price),
        registered_date: form.registered_date || null,
        stock_mysoku_path,
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

      const { error: insErr } = await supabase.from('estate_stocks').insert(payload)
      if (insErr) { setMsg('DB保存失敗: ' + insErr.message); setSubmitting(false); return }

      setMsg('保存しました')
      setForm({
        estate_entry_id: '', floor: '', area_sqm: '', list_price: '', registered_date: '',
        broker_name: '', broker_pref: '', broker_city: '', broker_town: '', broker_tel: '', broker_person: '', broker_mobile: '', broker_email: '', broker_mysoku_url: '', broker_photo_url: '',
        fundplan_url: '', status: '問い合わせ',
      })
      setPdf(null)
      const f = document.getElementById('mysoku') as HTMLInputElement | null
      if (f) f.value = ''
    } catch (e: unknown) {
      console.error(e)
      setMsg('保存に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地交渉DX（デモ）</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">ログイン中: s.omura@enjoyworks.jp</span>
            <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { supabase.auth.signOut().then(() => { window.location.href = '/' }) }}>
              サインアウト
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
          <ul className="flex flex-wrap gap-2 text-sm">
            <li><Link href="/sample/pattern_2_list/tab-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">一覧</Link></li>
            <li><Link href="/sample/pattern_2_list/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">登録</Link></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow p-5 space-y-6">
          <form onSubmit={(ev) => { handleSubmit(ev).catch(console.error) }} className="space-y-6">
            <section className="space-y-4">
              <h3 className="font-semibold">物件情報</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <label className="block">親（過去成約）
                  <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.estate_entry_id} onChange={onChange('estate_entry_id')} required>
                    <option value="">選択</option>
                    {entries.map(e => (
                      <option key={e.id} value={e.id}>{e.estate_name ?? '(名称未設定)'}（{e.id.slice(0,8)}…）</option>
                    ))}
                  </select>
                </label>
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
                <div className="block"><div className="text-gray-500">過去MIN成約価格との差異</div><div className="mt-1 font-semibold tabular-nums">{isNaN(derived.diff) ? '-' : `${(derived.diff >= 0 ? '+' : '-')}${Math.abs(derived.diff).toLocaleString('ja-JP')} 円`}</div></div>
                <label className="block">登録年月日
                  <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.registered_date} onChange={onChange('registered_date')} />
                </label>
                <div className="block"><div className="text-gray-500">経過日数</div><div className="mt-1">{derived.elapsed}</div></div>
                <label className="block md:col-span-3">PDF（販売図面・マイソク）
                  <input id="mysoku" type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">仲介不動産会社の情報</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <label className="block">社名<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="○○不動産" value={form.broker_name} onChange={onChange('broker_name')} /></label>
                <label className="block">所在地（都道府県）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="神奈川県" value={form.broker_pref} onChange={onChange('broker_pref')} /></label>
                <label className="block">所在地（市）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="藤沢市" value={form.broker_city} onChange={onChange('broker_city')} /></label>
                <label className="block md:col-span-3">所在地（町村）<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="鵠沼神明 3-2-402" value={form.broker_town} onChange={onChange('broker_town')} /></label>
                <label className="block">TEL<input type="tel" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="0466-xxx-xxxx" value={form.broker_tel} onChange={onChange('broker_tel')} /></label>
                <label className="block">担当者名<input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="山田 太郎" value={form.broker_person} onChange={onChange('broker_person')} /></label>
                <label className="block">携帯<input type="tel" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="090-xxxx-xxxx" value={form.broker_mobile} onChange={onChange('broker_mobile')} /></label>
                <label className="block md:col-span-2">メールアドレス<input type="email" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="agent@example.com" value={form.broker_email} onChange={onChange('broker_email')} /></label>
                <label className="block">添付（マイソクPDF URL）<input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="https://...pdf" value={form.broker_mysoku_url} onChange={onChange('broker_mysoku_url')} /></label>
                <label className="block">添付（現地写真 URL）<input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="https://...jpg" value={form.broker_photo_url} onChange={onChange('broker_photo_url')} /></label>
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
              <button type="reset" className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm" onClick={() => {
                setForm({ estate_entry_id: '', floor: '', area_sqm: '', list_price: '', registered_date: '', broker_name: '', broker_pref: '', broker_city: '', broker_town: '', broker_tel: '', broker_person: '', broker_mobile: '', broker_email: '', broker_mysoku_url: '', broker_photo_url: '', fundplan_url: '', status: '問い合わせ' }); setPdf(null); setMsg('')
              }}>リセット</button>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white text-sm" disabled={submitting}>登録</button>
            </div>
            <p className="text-xs text-gray-600">{msg}</p>
          </form>
        </div>
      </main>
      <style jsx global>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  )
}
