'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'

type Pref = '' | '兵庫' | '大阪'

type Row = {
  id: string
  estate_name: string | null
  management: string | null
  pref: Pref | null
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

type FormState = {
  estate_name: string
  management: string
  pref: Pref
  addr1: string
  addr2: string
  floor: string
  elevator: '' | '有' | '無'
  reins_registered_date: string
  contract_date: string
  max_price: string
  area_sqm: string
  coef_total: string
  interior_level_coef: string
  contract_year_coef: string
  past_min: string
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

export default function EditEntryPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string | undefined

  const [loading, setLoading] = useState<boolean>(true)
  const [msg, setMsg] = useState<string>('')
  const [row, setRow] = useState<Row | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    estate_name: '', management: '', pref: '', addr1: '', addr2: '',
    floor: '', elevator: '', reins_registered_date: '', contract_date: '',
    max_price: '', area_sqm: '', coef_total: '', interior_level_coef: '', contract_year_coef: '', past_min: '',
  })

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!id) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('id, estate_name, management, pref, addr1, addr2, max_price, area_sqm, coef_total, past_min, reins_registered_date, contract_date, floor, has_elevator, mysoku_pdf_path, interior_level_coef, contract_year_coef')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        const r = (data ?? null) as Row | null
        if (mounted) {
          setRow(r)
          if (r) {
            setForm({
              estate_name: r.estate_name ?? '',
              management: r.management ?? '',
              pref: (r.pref ?? '') as Pref,
              addr1: r.addr1 ?? '',
              addr2: r.addr2 ?? '',
              floor: (typeof r.floor === 'number' ? String(r.floor) : ''),
              elevator: r.has_elevator === true ? '有' : (r.has_elevator === false ? '無' : ''),
              reins_registered_date: r.reins_registered_date ?? '',
              contract_date: r.contract_date ?? '',
              max_price: (typeof r.max_price === 'number' ? String(r.max_price) : ''),
              area_sqm: (typeof r.area_sqm === 'number' ? String(r.area_sqm) : ''),
              coef_total: (typeof r.coef_total === 'number' ? String(r.coef_total) : ''),
              interior_level_coef: (typeof r.interior_level_coef === 'number' ? String(r.interior_level_coef) : ''),
              contract_year_coef: (typeof r.contract_year_coef === 'number' ? String(r.contract_year_coef) : ''),
              past_min: (typeof r.past_min === 'number' ? String(r.past_min) : ''),
            })
            if (r.mysoku_pdf_path) {
              try {
                const { data: signed } = await supabase
                  .storage
                  .from('uploads')
                  .createSignedUrl(r.mysoku_pdf_path, 600)
                if (mounted) setSignedUrl(signed?.signedUrl ?? null)
              } catch {
                if (mounted) setSignedUrl(null)
              }
            } else {
              setSignedUrl(null)
            }
          }
        }
      } catch (e) {
        console.error('[edit:load:error]', e)
        if (mounted) setMsg('読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, id])

  const onChange = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const existingPdfUrl = useMemo(() => row?.mysoku_pdf_path ?? null, [row])

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!id) return
    setMsg('更新中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); return }

      if (!form.estate_name.trim()) { setMsg('団地名は必須です'); return }

      const toInt = (v: string): number | null => v.trim() === '' ? null : Number.parseInt(v, 10)
      const toBigInt = (v: string): number | null => v.trim() === '' ? null : Number.parseInt(v, 10)
      const toNum = (v: string): number | null => v.trim() === '' ? null : Number.parseFloat(v)
      const toBool = (v: '' | '有' | '無'): boolean | null => v === '' ? null : (v === '有')

      let mysoku_pdf_path: string | null | undefined = undefined // undefined = no change; null = clear; string = replace
      if (pdf) {
        const sanitizedName = pdf.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
        const path = `${user.id}/mysoku/${Date.now()}-${sanitizedName}`
        const { error: upErr } = await supabase
          .storage
          .from('uploads')
          .upload(path, pdf, { upsert: false, contentType: 'application/pdf' })
        if (upErr) { setMsg('PDFアップロード失敗: ' + upErr.message); return }
        mysoku_pdf_path = path
      }

      const payload: Record<string, unknown> = {
        estate_name: form.estate_name.trim(),
        management: form.management.trim() || null,
        pref: (form.pref || null) as Pref | null,
        addr1: form.addr1.trim() || null,
        addr2: form.addr2.trim() || null,
        floor: toInt(form.floor),
        has_elevator: toBool(form.elevator),
        reins_registered_date: form.reins_registered_date || null,
        contract_date: form.contract_date || null,
        max_price: toBigInt(form.max_price),
        area_sqm: toNum(form.area_sqm),
        coef_total: toNum(form.coef_total),
        interior_level_coef: toNum(form.interior_level_coef),
        contract_year_coef: toNum(form.contract_year_coef),
        past_min: toBigInt(form.past_min),
      }
      if (typeof mysoku_pdf_path !== 'undefined') {
        payload.mysoku_pdf_path = mysoku_pdf_path
      }

      const { error: upErr } = await supabase
        .from('estate_entries')
        .update(payload)
        .eq('id', id)

      if (upErr) { setMsg('DB更新失敗: ' + upErr.message); return }

      setMsg('更新しました。詳細へ戻ります...')
      router.push(`/sample/pattern_2_list/tab-detail/${id}`)
    } catch (e) {
      console.error('[edit:update:error]', e)
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
            <button className="px-3 py-1.5 bg-gray-100 rounded-lg" onClick={() => { getSupabase().auth.signOut().then(() => { window.location.href = '/' }) }}>
              サインアウト
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-2 pt-1">
          <ul className="flex flex-wrap items-center gap-2 text-sm">
            <li>
              {id ? (
                <Link href={`/sample/pattern_2_list/tab-detail/${id}`} className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</Link>
              ) : (
                <span className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</span>
              )}
            </li>
            <li>
              <span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">編集</span>
            </li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section className="tab active">
          <div className="bg-white rounded-2xl shadow p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href={id ? `/sample/pattern_2_list/tab-detail/${id}` : '/sample/pattern_2_list/tab-list'} className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 戻る</Link>
                <h2 className="text-lg font-semibold">物件編集</h2>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : !row ? (
              <p className="text-sm text-red-600">データが見つかりませんでした</p>
            ) : (
              <form className="space-y-6" onSubmit={(e) => { handleSubmit(e).catch(console.error) }}>
                <section className="space-y-4">
                  <h3 className="font-semibold">基本情報</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <label className="block">団地名
                      <input name="estate_name" type="text" required className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）湘南パーク団地"
                        value={form.estate_name} onChange={onChange('estate_name')} />
                    </label>
                    <label className="block">管理
                      <select name="management" className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={form.management} onChange={onChange('management')}>
                        <option value="">選択</option>
                        <option value="一部委託">一部委託</option>
                        <option value="自主管理">自主管理</option>
                        <option value="全部委託">全部委託</option>
                      </select>
                    </label>
                    <label className="block">都道府県
                      <select name="pref" className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={form.pref} onChange={onChange('pref')}>
                        <option value="兵庫">兵庫</option>
                        <option value="大阪">大阪</option>
                        <option value="">選択</option>
                      </select>
                    </label>
                    <label className="block">所在地1
                      <input name="addr1" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）藤沢市鵠沼神明"
                        value={form.addr1} onChange={onChange('addr1')} />
                    </label>
                    <label className="block md:col-span-2">所在地2
                      <input name="addr2" type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="3-2-402"
                        value={form.addr2} onChange={onChange('addr2')} />
                    </label>
                    <div className="md:col-span-2 text-sm">
                      <div className="font-medium">PDF（過去成約事例の販売図面・マイソク）</div>
                      {existingPdfUrl ? (
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-gray-600 text-xs">登録済みPDFあり（置き換え可能）</span>
                          {signedUrl && (
                            <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">確認</a>
                          )}
                          <input id="pdf" name="mysoku_pdf" type="file" accept="application/pdf" className="w-full border rounded-lg px-3 py-2 bg-white"
                            onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                        </div>
                      ) : (
                        <input id="pdf" name="mysoku_pdf" type="file" accept="application/pdf" className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                          onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                      )}
                    </div>
                    <label className="block">階数（入力）
                      <input name="floor" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="5"
                        value={form.floor} onChange={onChange('floor')} />
                    </label>
                    <label className="block">エレベーター有無
                      <select name="elevator" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.elevator} onChange={onChange('elevator')}>
                        <option value="">選択</option>
                        <option value="有">有</option>
                        <option value="無">無</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="font-semibold">成約実績・属性</h3>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <label className="block">レインズにて登録した年月日
                      <input name="reins_registered_date" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.reins_registered_date} onChange={onChange('reins_registered_date')} />
                    </label>
                    <label className="block">成約年月日
                      <input name="contract_date" type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.contract_date} onChange={onChange('contract_date')} />
                    </label>
                    <label className="block">max price（円）
                      <input name="max_price" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="12000000"
                        value={form.max_price} onChange={onChange('max_price')} />
                    </label>
                    <label className="block">面積（㎡）
                      <input name="area_sqm" type="number" min={0} step={0.01} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="68.32"
                        value={form.area_sqm} onChange={onChange('area_sqm')} />
                    </label>
                    <label className="block">係数（合計）
                      <select name="coef_total" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.coef_total} onChange={onChange('coef_total')}>
                        <option value="">選択</option>
                        <option value="1.00">1.00</option>
                        <option value="1.05">1.05</option>
                        <option value="1.10">1.10</option>
                        <option value="1.15">1.15</option>
                        <option value="1.2">1.2</option>
                        <option value="1.25">1.25</option>
                        <option value="1.30">1.30</option>
                      </select>
                    </label>
                    <label className="block">内装レベル係数
                      <select name="interior_level_coef" className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums"
                        value={form.interior_level_coef} onChange={onChange('interior_level_coef')}>
                        <option value="">選択</option>
                        <option value="0.00">0.00</option>
                        <option value="0.05">0.05</option>
                        <option value="0.10">0.10</option>
                        <option value="0.15">0.15</option>
                        <option value="0.20">0.20</option>
                      </select>
                    </label>
                    <label className="block">成約年数上乗せ係数
                      <select name="contract_year_coef" className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums"
                        value={form.contract_year_coef} onChange={onChange('contract_year_coef')}>
                        <option value="">選択</option>
                        <option value="0.00">1年未満(0.00)</option>
                        <option value="0.02">1~2年前(0.02)</option>
                        <option value="0.04">2~3年前(0.04)</option>
                        <option value="0.06">3~5年前(0.06)</option>
                        <option value="0.08">5年以上前(0.08)</option>
                        <option value="0.1">10年以上前(0.1)</option>
                      </select>
                    </label>
                    <label className="block">過去MIN価格
                      <input name="past_min" type="number" min={0} step={1} className="mt-1 w-full border rounded-lg px-3 py-2 tabular-nums" placeholder="4800000"
                        value={form.past_min} onChange={onChange('past_min')} />
                    </label>
                  </div>
                </section>

                <div className="flex items-center justify-end gap-2">
                  <Link href={id ? `/sample/pattern_2_list/tab-detail/${id}` : '/sample/pattern_2_list/tab-list'} className="px-3 py-1.5 bg-gray-100 rounded-lg">キャンセル</Link>
                  <button type="submit" className="px-3 py-1.5 bg-black text-white rounded-lg">保存</button>
                </div>
                <p className="text-xs text-gray-600">{msg}</p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
    </RequireAuth>
  )
}
