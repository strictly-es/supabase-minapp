'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import { getSupabase } from '@/lib/supabaseClient'

type Pref = '' | '東京' | '神奈川' | '千葉' | '埼玉' | '大阪' | '兵庫'
type YesNo = '' | '有' | '無'
type Access = '' | '徒歩' | 'バス' | '車・その他'

type ComplexForm = {
  name: string
  pref: Pref
  city: string
  town: string
  builtYm: string
  unitCount: string
  stationName: string
  stationAccess: Access
  stationMinutes: string
  seller: string
  builder: string
  mgmtCompany: string
  mgmtType: '' | '自主管理' | '一部委託' | '全部委託'
  hasElevator: YesNo
  floorPattern: '' | '①保守的' | '②中間' | '③攻め' | '④超攻め'
}

type EvalOption = { value: string; label: string; score: number }
type EvalState = {
  marketDeals: string
  rentDemand: string
  inventory: string
  walk: string
  access: string
  convenience: string
  scale: string
  elevator: string
  mgmt: string
  appearance: string
  parking: string
  view: string
  future: string
  focus: string
  support: string
  comment: string
}

type StoredOption = { value?: string; label?: string; score?: number }
type StoredFactors = {
  market?: { deals?: StoredOption; rentDemand?: StoredOption; inventory?: StoredOption }
  location?: { walk?: StoredOption; access?: StoredOption; convenience?: StoredOption }
  building?: { scale?: StoredOption; elevator?: StoredOption; mgmt?: StoredOption; appearance?: StoredOption; parking?: StoredOption; view?: StoredOption }
  plus?: { future?: StoredOption; focus?: StoredOption; support?: StoredOption }
}

const prefOptions: Pref[] = ['東京', '神奈川', '千葉', '埼玉', '大阪', '兵庫', '']
const floorCoefPatterns = [
  { value: '①保守的', detail: '1F 1.00 / 2F 0.98 / 3F 0.95 / 4F 0.90 / 5F 0.85' },
  { value: '②中間', detail: '1F 1.00 / 2F 0.99 / 3F 0.96 / 4F 0.92 / 5F 0.88' },
  { value: '③攻め', detail: '1F 1.00 / 2F 1.00 / 3F 0.99 / 4F 0.98 / 5F 0.97' },
  { value: '④超攻め', detail: '1F 0.98 / 2F 0.99 / 3F 1.00 / 4F 1.03 / 5F 1.07' },
]

const evalOptions: Record<keyof Omit<EvalState, 'comment'>, EvalOption[]> = {
  marketDeals: [
    { value: 'rich', label: '豊富（年に全戸数×3％以上）10', score: 10 },
    { value: 'normal', label: '普通（過去3年で5件以上）5', score: 5 },
    { value: 'low', label: '低い 0', score: 0 },
  ],
  rentDemand: [
    { value: 'high', label: '高い（年間5件以上）5', score: 5 },
    { value: 'mid', label: '普通（年間2～4件）3', score: 3 },
    { value: 'low', label: '低い 0', score: 0 },
  ],
  inventory: [
    { value: 'down', label: '減少（-1％以上）5', score: 5 },
    { value: 'flat', label: '横ばい（～＋10％）3', score: 3 },
    { value: 'up', label: '増加（＋10％以上）0', score: 0 },
  ],
  walk: [
    { value: '5', label: '5分以内 10', score: 10 },
    { value: '10', label: '10分以内 8', score: 8 },
    { value: '15', label: '15分以内 5', score: 5 },
    { value: 'over15', label: '15分超 0', score: 0 },
  ],
  access: [
    { value: 'direct30', label: '乗換なし30分以内 5', score: 5 },
    { value: 'one40', label: '1回乗換40分以内 3', score: 3 },
    { value: 'two', label: '2回以上必要 2', score: 2 },
    { value: 'oneHour', label: '1時間以上 1', score: 1 },
    { value: 'over90', label: '1.5時間以上 0', score: 0 },
  ],
  convenience: [
    { value: 'all', label: '全部徒歩圏 10', score: 10 },
    { value: 'half', label: '半分徒歩圏 6', score: 6 },
    { value: 'few', label: '少ない 3', score: 3 },
    { value: 'none', label: 'ほぼなし 0', score: 0 },
  ],
  scale: [
    { value: 'large', label: '大規模（100戸以上）5', score: 5 },
    { value: 'mid', label: '中規模（50〜99戸）3', score: 3 },
    { value: 'small', label: '小規模 0', score: 0 },
  ],
  elevator: [
    { value: 'yes', label: 'あり 5', score: 5 },
    { value: 'no', label: 'なし 0', score: 0 },
  ],
  mgmt: [
    { value: 'good', label: '委託＋修繕充実 10', score: 10 },
    { value: 'mid', label: '委託（修繕不足）6', score: 6 },
    { value: 'min', label: '自主管理で最低限 3', score: 3 },
    { value: 'bad', label: '管理不全 0', score: 0 },
  ],
  appearance: [
    { value: 'good', label: '良好 5', score: 5 },
    { value: 'normal', label: '普通 3', score: 3 },
    { value: 'bad', label: '汚い・荒れている 0', score: 0 },
  ],
  parking: [
    { value: 'enough', label: '余裕あり 5', score: 5 },
    { value: 'lack', label: '足りない・古い 2', score: 2 },
    { value: 'none', label: 'なし 0', score: 0 },
  ],
  view: [
    { value: 'great', label: '南向き・眺望良 10', score: 10 },
    { value: 'south', label: '南向きのみ 6', score: 6 },
    { value: 'north', label: '北向き・眺望悪い 0', score: 0 },
  ],
  future: [
    { value: 'big', label: '大きい 5', score: 5 },
    { value: 'mid', label: '普通 3', score: 3 },
    { value: 'small', label: '小さい 0', score: 0 },
  ],
  focus: [
    { value: 'high', label: '高い 5', score: 5 },
    { value: 'mid', label: '普通 3', score: 3 },
    { value: 'low', label: '低い 0', score: 0 },
  ],
  support: [
    { value: 'yes', label: '有り 5', score: 5 },
    { value: 'no', label: '無し 0', score: 0 },
  ],
}

const initialEval: EvalState = {
  marketDeals: 'rich',
  rentDemand: 'high',
  inventory: 'down',
  walk: '5',
  access: 'direct30',
  convenience: 'all',
  scale: 'large',
  elevator: 'yes',
  mgmt: 'good',
  appearance: 'good',
  parking: 'enough',
  view: 'great',
  future: 'big',
  focus: 'high',
  support: 'yes',
  comment: '',
}

const initialComplex: ComplexForm = {
  name: '',
  pref: '',
  city: '',
  town: '',
  builtYm: '',
  unitCount: '',
  stationName: '',
  stationAccess: '',
  stationMinutes: '',
  seller: '',
  builder: '',
  mgmtCompany: '',
  mgmtType: '',
  hasElevator: '',
  floorPattern: '',
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

function calcBuiltAge(builtYm: string): number | null {
  if (!builtYm) return null
  const dt = new Date(`${builtYm}-01`)
  if (Number.isNaN(+dt)) return null
  const now = new Date()
  let years = now.getFullYear() - dt.getFullYear()
  const mDiff = now.getMonth() - dt.getMonth()
  if (mDiff < 0) years -= 1
  return years >= 0 && Number.isFinite(years) ? years : null
}

function getScore(key: keyof Omit<EvalState, 'comment'>, state: EvalState): number {
  const opt = evalOptions[key].find((o) => o.value === state[key])
  return opt?.score ?? 0
}

export default function TabComplexEditPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string | undefined
  const [form, setForm] = useState<ComplexForm>(initialComplex)
  const [evalForm, setEvalForm] = useState<EvalState>(initialEval)
  const [builtAge, setBuiltAge] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setBuiltAge(calcBuiltAge(form.builtYm))
  }, [form.builtYm])

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!id) return
      setLoading(true); setMsg('')
      try {
        const { data, error } = await supabase
          .from('housing_complexes')
          .select(`
            id, name, pref, city, town, built_ym,
            station_name, station_access_type, station_minutes,
            unit_count, has_elevator, floor_coef_pattern,
            seller, builder, mgmt_company, mgmt_type
          `)
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!data) {
          if (mounted) setMsg('データが見つかりません')
          return
        }
        if (mounted) {
          setForm({
            name: data.name ?? '',
            pref: (data.pref ?? '') as Pref,
            city: data.city ?? '',
            town: data.town ?? '',
            builtYm: data.built_ym ?? '',
            unitCount: typeof data.unit_count === 'number' ? String(data.unit_count) : '',
            stationName: data.station_name ?? '',
            stationAccess: (data.station_access_type ?? '') as Access,
            stationMinutes: typeof data.station_minutes === 'number' ? String(data.station_minutes) : '',
            seller: data.seller ?? '',
            builder: data.builder ?? '',
            mgmtCompany: data.mgmt_company ?? '',
            mgmtType: (data.mgmt_type ?? '') as ComplexForm['mgmtType'],
            hasElevator: data.has_elevator === true ? '有' : (data.has_elevator === false ? '無' : ''),
            floorPattern: (data.floor_coef_pattern ?? '') as ComplexForm['floorPattern'],
          })
        }

        const { data: evalData, error: evalErr } = await supabase
          .from('complex_evaluations')
          .select('id, factors, note')
          .eq('complex_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (evalErr) throw evalErr
        if (mounted && evalData) {
          const factors = (evalData.factors ?? null) as StoredFactors | null
          const pick = (v: StoredOption | undefined, fallback: string) => {
            return typeof v?.value === 'string' ? v.value : fallback
          }
          setEvalForm({
            marketDeals: pick(factors?.market?.deals, initialEval.marketDeals),
            rentDemand: pick(factors?.market?.rentDemand, initialEval.rentDemand),
            inventory: pick(factors?.market?.inventory, initialEval.inventory),
            walk: pick(factors?.location?.walk, initialEval.walk),
            access: pick(factors?.location?.access, initialEval.access),
            convenience: pick(factors?.location?.convenience, initialEval.convenience),
            scale: pick(factors?.building?.scale, initialEval.scale),
            elevator: pick(factors?.building?.elevator, initialEval.elevator),
            mgmt: pick(factors?.building?.mgmt, initialEval.mgmt),
            appearance: pick(factors?.building?.appearance, initialEval.appearance),
            parking: pick(factors?.building?.parking, initialEval.parking),
            view: pick(factors?.building?.view, initialEval.view),
            future: pick(factors?.plus?.future, initialEval.future),
            focus: pick(factors?.plus?.focus, initialEval.focus),
            support: pick(factors?.plus?.support, initialEval.support),
            comment: evalData.note ?? '',
          })
        }
      } catch (e) {
        console.error('[complex/edit:load]', e)
        if (mounted) setMsg('読み込みに失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [supabase, id])

  const categoryTotals = useMemo(() => {
    const market = getScore('marketDeals', evalForm) + getScore('rentDemand', evalForm) + getScore('inventory', evalForm)
    const loc = getScore('walk', evalForm) + getScore('access', evalForm) + getScore('convenience', evalForm)
    const bld = getScore('scale', evalForm) + getScore('elevator', evalForm) + getScore('mgmt', evalForm) + getScore('appearance', evalForm) + getScore('parking', evalForm) + getScore('view', evalForm)
    const plus = getScore('future', evalForm) + getScore('focus', evalForm) + getScore('support', evalForm)
    return { market, loc, bld, plus }
  }, [evalForm])

  const totalScore = useMemo(() => categoryTotals.market + categoryTotals.loc + categoryTotals.bld + categoryTotals.plus, [categoryTotals])

  const onComplexChange = <K extends keyof ComplexForm>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }
  const onEvalChange = <K extends keyof EvalState>(key: K) => (e: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    setEvalForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!id) { setMsg('対象IDが不明です'); return }
    setSaving(true); setMsg('更新中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) { setMsg('ログインが必要です'); setSaving(false); return }
      if (!form.name.trim()) { setMsg('団地名は必須です'); setSaving(false); return }

      const toInt = (v: string): number | null => v.trim() === '' ? null : Number.parseInt(v, 10)
      const toBool = (v: YesNo): boolean | null => v === '' ? null : (v === '有')

      const complexPayload = {
        name: form.name.trim(),
        pref: form.pref || null,
        city: form.city.trim() || null,
        town: form.town.trim() || null,
        built_ym: form.builtYm || null,
        built_age: builtAge,
        station_name: form.stationName.trim() || null,
        station_access_type: form.stationAccess || null,
        station_minutes: toInt(form.stationMinutes),
        seller: form.seller.trim() || null,
        builder: form.builder.trim() || null,
        mgmt_company: form.mgmtCompany.trim() || null,
        mgmt_type: form.mgmtType || null,
        unit_count: toInt(form.unitCount),
        has_elevator: toBool(form.hasElevator),
        floor_coef_pattern: form.floorPattern || null,
        updated_by: user.id,
      }

      const { error: upErr } = await supabase
        .from('housing_complexes')
        .update(complexPayload)
        .eq('id', id)
      if (upErr) throw new Error('団地更新失敗: ' + upErr.message)

      const factors = {
        market: {
          deals: evalOptions.marketDeals.find((o) => o.value === evalForm.marketDeals),
          rentDemand: evalOptions.rentDemand.find((o) => o.value === evalForm.rentDemand),
          inventory: evalOptions.inventory.find((o) => o.value === evalForm.inventory),
        },
        location: {
          walk: evalOptions.walk.find((o) => o.value === evalForm.walk),
          access: evalOptions.access.find((o) => o.value === evalForm.access),
          convenience: evalOptions.convenience.find((o) => o.value === evalForm.convenience),
        },
        building: {
          scale: evalOptions.scale.find((o) => o.value === evalForm.scale),
          elevator: evalOptions.elevator.find((o) => o.value === evalForm.elevator),
          mgmt: evalOptions.mgmt.find((o) => o.value === evalForm.mgmt),
          appearance: evalOptions.appearance.find((o) => o.value === evalForm.appearance),
          parking: evalOptions.parking.find((o) => o.value === evalForm.parking),
          view: evalOptions.view.find((o) => o.value === evalForm.view),
        },
        plus: {
          future: evalOptions.future.find((o) => o.value === evalForm.future),
          focus: evalOptions.focus.find((o) => o.value === evalForm.focus),
          support: evalOptions.support.find((o) => o.value === evalForm.support),
        },
      }

      const { error: evalErr } = await supabase.from('complex_evaluations').insert({
        complex_id: id,
        total_score: totalScore,
        factors,
        note: evalForm.comment.trim() || null,
        created_by: user.id,
        updated_by: user.id,
      })
      if (evalErr) throw new Error('評価保存失敗: ' + evalErr.message)

      setMsg('更新しました')
      router.push('/tab-complex-list')
    } catch (e: unknown) {
      console.error('[complex/update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <RequireAuth>
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
            <h1 className="text-lg font-semibold">団地基本情報 + 評価シート（編集）</h1>
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
              <li><Link href="/tab-complex-list" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地一覧</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">団地基本情報</span></li>
              <li><Link href="/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約登録</Link></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section id="tab-complex" className="tab active">
          <div className="bg-white rounded-2xl shadow p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">団地基本情報 + 評価シート（編集）</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">{loading ? '読み込み中...' : (msg || '内容を更新してください')}</span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={(ev) => { handleSubmit(ev).catch(console.error) }}>
              <section className="space-y-4">
                <h3 className="font-semibold">基本属性</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block">団地名
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）湘南パーク団地" value={form.name} onChange={onComplexChange('name')} required />
                  </label>
                  <label className="block">都道府県
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.pref} onChange={onComplexChange('pref')}>
                      <option value="">選択</option>
                      {prefOptions.filter((p): p is Pref => !!p).map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="block">市区
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）藤沢市" value={form.city} onChange={onComplexChange('city')} />
                  </label>
                  <label className="block md:col-span-2">町村以降
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）鵠沼神明3-2-402" value={form.town} onChange={onComplexChange('town')} />
                  </label>
                  <label className="block">築年月
                    <input type="month" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.builtYm} onChange={onComplexChange('builtYm')} />
                  </label>
                  <label className="block">築年数（自動）
                    <input type="text" readOnly className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-600" placeholder="自動計算" value={builtAge !== null ? `${builtAge} 年` : ''} />
                  </label>
                  <label className="block">戸数
                    <input type="number" min="0" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）120" value={form.unitCount} onChange={onComplexChange('unitCount')} />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">交通・利便</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block md:col-span-2">最寄り駅（電車）
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）藤沢本町" value={form.stationName} onChange={onComplexChange('stationName')} />
                  </label>
                  <label className="block">アクセス手段
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.stationAccess} onChange={onComplexChange('stationAccess')}>
                      <option value="">選択</option>
                      <option value="徒歩">徒歩</option>
                      <option value="バス">バス</option>
                      <option value="車・その他">車・その他</option>
                    </select>
                  </label>
                  <label className="block">所要時間（分）
                    <input type="number" min="0" step="1" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）8" value={form.stationMinutes} onChange={onComplexChange('stationMinutes')} />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">管理・建物</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <label className="block">分譲会社
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）三菱地所" value={form.seller} onChange={onComplexChange('seller')} />
                  </label>
                  <label className="block">施工会社
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）大林組" value={form.builder} onChange={onComplexChange('builder')} />
                  </label>
                  <label className="block">管理会社
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）東急コミュニティー" value={form.mgmtCompany} onChange={onComplexChange('mgmtCompany')} />
                  </label>
                  <label className="block">管理形態
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.mgmtType} onChange={onComplexChange('mgmtType')}>
                      <option value="">選択</option>
                      <option value="自主管理">自主管理</option>
                      <option value="一部委託">一部委託</option>
                      <option value="全部委託">全部委託</option>
                    </select>
                  </label>
                  <label className="block">エレベーター
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.hasElevator} onChange={onComplexChange('hasElevator')}>
                      <option value="">選択</option>
                      <option value="有">有</option>
                      <option value="無">無</option>
                    </select>
                  </label>
                  <label className="block">階数効用比率の選択
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.floorPattern} onChange={onComplexChange('floorPattern')}>
                      <option value="">選択</option>
                      {floorCoefPatterns.map((p) => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                  </label>
                </div>
                <div className="overflow-auto">
                  <table className="text-xs border border-gray-200 rounded-lg w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">パターン</th>
                        <th className="px-3 py-2">1F</th>
                        <th className="px-3 py-2">2F</th>
                        <th className="px-3 py-2">3F</th>
                        <th className="px-3 py-2">4F</th>
                        <th className="px-3 py-2">5F</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-1">①保守的</td><td className="px-3 py-1">1.00</td><td className="px-3 py-1">0.98</td><td className="px-3 py-1">0.95</td><td className="px-3 py-1">0.90</td><td className="px-3 py-1">0.85</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1">②中間</td><td className="px-3 py-1">1.00</td><td className="px-3 py-1">0.99</td><td className="px-3 py-1">0.96</td><td className="px-3 py-1">0.92</td><td className="px-3 py-1">0.88</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1">③攻め</td><td className="px-3 py-1">1.00</td><td className="px-3 py-1">1.00</td><td className="px-3 py-1">0.99</td><td className="px-3 py-1">0.98</td><td className="px-3 py-1">0.97</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1">④超攻め</td><td className="px-3 py-1">0.98</td><td className="px-3 py-1">0.99</td><td className="px-3 py-1">1.00</td><td className="px-3 py-1">1.03</td><td className="px-3 py-1">1.07</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">評価シート（100点満点）</h3>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
                    <div>
                      <div className="text-sm text-gray-500">総合点（自動計算）</div>
                      <div className="text-3xl font-semibold"><span className="num">{totalScore}</span><span className="text-base text-gray-500"> / 100</span></div>
                    </div>
                    <div className="text-xs text-gray-500">
                      <div>市場性 {categoryTotals.market}</div>
                      <div>立地 {categoryTotals.loc}</div>
                      <div>建物 {categoryTotals.bld}</div>
                      <div>その他 {categoryTotals.plus}</div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">市場性（20点）</span>
                      <span className="text-xs text-gray-500">過去3年</span>
                    </div>
                    <label className="block">成約事例
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.marketDeals} onChange={onEvalChange('marketDeals')}>
                        {evalOptions.marketDeals.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">賃貸需要
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.rentDemand} onChange={onEvalChange('rentDemand')}>
                        {evalOptions.rentDemand.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">在庫増減率
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.inventory} onChange={onEvalChange('inventory')}>
                        {evalOptions.inventory.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">立地（25点）</span>
                      <span className="text-xs text-gray-500">交通/利便</span>
                    </div>
                    <label className="block">駅徒歩
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.walk} onChange={onEvalChange('walk')}>
                        {evalOptions.walk.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">都心・ターミナルアクセス
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.access} onChange={onEvalChange('access')}>
                        {evalOptions.access.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">生活利便性
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.convenience} onChange={onEvalChange('convenience')}>
                        {evalOptions.convenience.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">建物（40点）</span>
                      <span className="text-xs text-gray-500">規模/管理/設備</span>
                    </div>
                    <label className="block">団地規模（戸数）
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.scale} onChange={onEvalChange('scale')}>
                        {evalOptions.scale.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">エレベーター
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.elevator} onChange={onEvalChange('elevator')}>
                        {evalOptions.elevator.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">管理状態
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.mgmt} onChange={onEvalChange('mgmt')}>
                        {evalOptions.mgmt.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">外観・共用部
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.appearance} onChange={onEvalChange('appearance')}>
                        {evalOptions.appearance.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">駐車場
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.parking} onChange={onEvalChange('parking')}>
                        {evalOptions.parking.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">方角・眺望
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.view} onChange={onEvalChange('view')}>
                        {evalOptions.view.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">その他加点（15点）</span>
                      <span className="text-xs text-gray-500">将来性/支援</span>
                    </div>
                    <label className="block">将来性（再開発余地）
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.future} onChange={onEvalChange('future')}>
                        {evalOptions.future.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">行政・プレイヤー注力度
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.focus} onChange={onEvalChange('focus')}>
                        {evalOptions.focus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">高齢者支援サービス・NPO等
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.support} onChange={onEvalChange('support')}>
                        {evalOptions.support.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <div className="pt-2 border-t mt-2">
                      <label className="block text-sm">総合コメント
                        <textarea rows={3} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="メモ／定性的な補足" value={evalForm.comment} onChange={onEvalChange('comment')} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div>
                    <div className="text-sm text-gray-500">総合点（自動計算）</div>
                    <div className="text-3xl font-semibold"><span className="num">{totalScore}</span><span className="text-base text-gray-500"> / 100</span></div>
                  </div>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-60" disabled={saving}>
                    {saving ? '更新中...' : '更新'}
                  </button>
                </div>
              </section>
            </form>
          </div>
        </section>
      </main>
    </div>
    </RequireAuth>
  )
}
