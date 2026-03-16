'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { buildDetailEditPayload, formatInteriorLevelCoef, type DetailEditPref } from '@/lib/detailEdit'
import { updateEntry, uploadEntryPdf } from '@/lib/repositories/entries'
import { getSupabase } from '@/lib/supabaseClient'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import DetailBasicsSection from './DetailBasicsSection'
import DetailPerformanceSection from './DetailPerformanceSection'
import type { FormState, Row } from './detailEditShared'

type Pref = DetailEditPref

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
              interior_level_coef: formatInteriorLevelCoef(r.interior_level_coef),
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

      let mysoku_pdf_path: string | null | undefined = undefined // undefined = no change; null = clear; string = replace
      if (pdf) {
        mysoku_pdf_path = await uploadEntryPdf(supabase, pdf, user.id, 'detail-edit', null)
      }

      const payload = buildDetailEditPayload(form, mysoku_pdf_path)
      await updateEntry(supabase, id, payload)

      setMsg('更新しました。詳細へ戻ります...')
      router.push(`/tab-detail/${id}`)
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
            <h1 className="text-lg font-semibold">団地レボリューション(デモ)</h1>
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
                <Link href={`/tab-detail/${id}`} className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">詳細</Link>
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
                <Link href={id ? `/tab-detail/${id}` : '/tab-list'} className="px-2 py-1.5 rounded-lg bg-gray-100 text-sm">← 戻る</Link>
                <h2 className="text-lg font-semibold">物件編集</h2>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : !row ? (
              <p className="text-sm text-red-600">データが見つかりませんでした</p>
            ) : (
              <form className="space-y-6" onSubmit={(e) => { handleSubmit(e).catch(console.error) }}>
                <DetailBasicsSection
                  form={form}
                  existingPdfUrl={existingPdfUrl}
                  signedUrl={signedUrl}
                  onChange={onChange}
                  onPdfChange={setPdf}
                />

                <DetailPerformanceSection
                  form={form}
                  onChange={onChange}
                />

                <div className="flex items-center justify-end gap-2">
                  <Link href={id ? `/tab-detail/${id}` : '/tab-list'} className="px-3 py-1.5 bg-gray-100 rounded-lg">キャンセル</Link>
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
