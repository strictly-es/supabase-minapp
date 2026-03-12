'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import {
  buildReferenceValueSummaries,
  CONDITION_STATUS_OPTIONS,
  type ConditionSummaryRow,
  type FloorSummaryRow,
  type ReferenceValueEntry,
} from '@/lib/referenceValue'
import { getSupabase } from '@/lib/supabaseClient'

type Pref = '' | '東京' | '神奈川' | '千葉' | '埼玉' | '大阪' | '兵庫'
type Access = '' | '徒歩' | 'バス' | '車・その他'
type BuildingStructure = '' | 'SRC' | 'RC' | '鉄骨造' | '木造'

type ComplexForm = {
  name: string
  pref: Pref
  city: string
  town: string
  mapUrl: string
  builtYm: string
  unitCount: string
  stationName: string
  stationAccess: Access
  stationMinutes: string
  seller: string
  builder: string
  mgmtCompany: string
  mgmtType: '' | '自主管理' | '一部委託' | '全部委託'
  buildingStructure: BuildingStructure
  floorCount: string
  sameAddressNewSeismicCase: string
  sameAddressOldSeismicCase: string
  sameStationNewSeismicCase: string
  sameStationOldSeismicCase: string
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

type MarketDealsValue = 'rich' | 'normal' | 'low' | 'unregistered'
type MarketDealsAutoState = {
  value: MarketDealsValue
  contractCount: number
  averagePerYear: number | null
  ratioPerUnit: number | null
}

const prefOptions: Pref[] = ['東京', '神奈川', '千葉', '埼玉', '大阪', '兵庫', '']
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
    { value: '5', label: '需要指数2.0以上 5', score: 5 },
    { value: '3', label: '需要指数1.0~1.99 3', score: 3 },
    { value: '0', label: '需要指数0.99以下 0', score: 0 },
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
    { value: '5', label: '空あり 5', score: 5 },
    { value: '2', label: '近隣あり 2', score: 2 },
    { value: '0', label: '空きなし 0', score: 0 },
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
  inventory: '5',
  walk: '5',
  access: 'direct30',
  convenience: 'all',
  scale: 'large',
  elevator: 'yes',
  mgmt: 'good',
  appearance: 'good',
  parking: '5',
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
  mapUrl: '',
  builtYm: '',
  unitCount: '',
  stationName: '',
  stationAccess: '',
  stationMinutes: '',
  seller: '',
  builder: '',
  mgmtCompany: '',
  mgmtType: '',
  buildingStructure: '',
  floorCount: '',
  sameAddressNewSeismicCase: '',
  sameAddressOldSeismicCase: '',
  sameStationNewSeismicCase: '',
  sameStationOldSeismicCase: '',
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

function formatUnitPrice(value: number | null): string {
  if (value == null) return '—'
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}円/㎡`
}

export default function TabComplexEditPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string | undefined
  const [form, setForm] = useState<ComplexForm>(initialComplex)
  const [evalForm, setEvalForm] = useState<EvalState>(initialEval)
  const [marketDealsAuto, setMarketDealsAuto] = useState<MarketDealsAutoState>({
    value: 'unregistered',
    contractCount: 0,
    averagePerYear: null,
    ratioPerUnit: null,
  })
  const [conditionSummaries, setConditionSummaries] = useState<ConditionSummaryRow[]>(
    CONDITION_STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label, max: null, mean: null })),
  )
  const [floorSummaries, setFloorSummaries] = useState<FloorSummaryRow[]>([])
  const [builtAge, setBuiltAge] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setBuiltAge(calcBuiltAge(form.builtYm))
  }, [form.builtYm])

  useEffect(() => {
    let mounted = true

    async function syncMarketDeals() {
      if (!id) return
      try {
        const since = new Date()
        since.setFullYear(since.getFullYear() - 3)
        const sinceText = since.toISOString()
        const { count, error } = await supabase
          .from('estate_entries')
          .select('id', { count: 'exact', head: true })
          .eq('complex_id', id)
          .is('deleted_at', null)
          .gte('contract_date', sinceText)
        if (error) throw error

        const contractCount = count ?? 0
        const unitCount = Number.parseInt(form.unitCount, 10)
        const denominator = Number.isFinite(unitCount) && unitCount > 0 ? unitCount : null
        const averagePerYear = contractCount > 0 ? contractCount / 3 : 0
        const ratioPerUnit = denominator && denominator > 0 ? averagePerYear / denominator : null
        const value: MarketDealsValue =
          contractCount === 0
            ? 'unregistered'
            : ratioPerUnit != null && ratioPerUnit >= 0.03
              ? 'rich'
              : contractCount >= 5
                ? 'normal'
                : 'low'

        if (!mounted) return
        setMarketDealsAuto({
          value,
          contractCount,
          averagePerYear,
          ratioPerUnit,
        })
        setEvalForm((prev) => ({ ...prev, marketDeals: value }))
      } catch (e) {
        console.error('[complex/edit:marketDeals:auto]', e)
        if (!mounted) return
        setMarketDealsAuto({
          value: 'unregistered',
          contractCount: 0,
          averagePerYear: null,
          ratioPerUnit: null,
        })
        setEvalForm((prev) => ({ ...prev, marketDeals: 'unregistered' }))
      }
    }

    syncMarketDeals().catch(console.error)
    return () => { mounted = false }
  }, [supabase, id, form.unitCount])

  useEffect(() => {
    let mounted = true

    async function loadConditionSummaries() {
      if (!id) return
      try {
        const { data, error } = await supabase
          .from('estate_entries')
          .select('condition_status, floor, unit_price, contract_price, area_sqm')
          .eq('complex_id', id)
          .is('deleted_at', null)
          .limit(5000)
        if (error) throw error

        const { conditionSummaries: summaries, floorSummaries: floorSummaryRows } =
          buildReferenceValueSummaries((data ?? []) as ReferenceValueEntry[])

        if (mounted) {
          setConditionSummaries(summaries)
          setFloorSummaries(floorSummaryRows)
        }
      } catch (e) {
        console.error('[complex/edit:condition-summary]', e)
        if (mounted) {
          setConditionSummaries(CONDITION_STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label, max: null, mean: null })))
          setFloorSummaries([])
        }
      }
    }

    loadConditionSummaries().catch(console.error)
    return () => { mounted = false }
  }, [supabase, id])

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
            unit_count, building_structure, floor_count,
            seller, builder, mgmt_company, mgmt_type, map_url,
            same_address_new_seismic_case, same_address_old_seismic_case,
            same_station_new_seismic_case, same_station_old_seismic_case
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
            mapUrl: data.map_url ?? '',
            builtYm: data.built_ym ?? '',
            unitCount: typeof data.unit_count === 'number' ? String(data.unit_count) : '',
            stationName: data.station_name ?? '',
            stationAccess: (data.station_access_type ?? '') as Access,
            stationMinutes: typeof data.station_minutes === 'number' ? String(data.station_minutes) : '',
            seller: data.seller ?? '',
            builder: data.builder ?? '',
            mgmtCompany: data.mgmt_company ?? '',
            mgmtType: (data.mgmt_type ?? '') as ComplexForm['mgmtType'],
            buildingStructure: (data.building_structure ?? '') as ComplexForm['buildingStructure'],
            floorCount: typeof data.floor_count === 'number' ? String(data.floor_count) : '',
            sameAddressNewSeismicCase: data.same_address_new_seismic_case ?? '',
            sameAddressOldSeismicCase: data.same_address_old_seismic_case ?? '',
            sameStationNewSeismicCase: data.same_station_new_seismic_case ?? '',
            sameStationOldSeismicCase: data.same_station_old_seismic_case ?? '',
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

  const marketDealsOptions = useMemo(() => {
    if (marketDealsAuto.value !== 'unregistered') return evalOptions.marketDeals
    return [
      { value: 'unregistered', label: '過去成約情報が登録されていません', score: 0 },
      ...evalOptions.marketDeals,
    ]
  }, [marketDealsAuto.value])

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
      const complexPayload = {
        name: form.name.trim(),
        pref: form.pref || null,
        city: form.city.trim() || null,
        town: form.town.trim() || null,
        map_url: form.mapUrl.trim() || null,
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
        building_structure: form.buildingStructure || null,
        floor_count: toInt(form.floorCount),
        same_address_new_seismic_case: form.sameAddressNewSeismicCase.trim() || null,
        same_address_old_seismic_case: form.sameAddressOldSeismicCase.trim() || null,
        same_station_new_seismic_case: form.sameStationNewSeismicCase.trim() || null,
        same_station_old_seismic_case: form.sameStationOldSeismicCase.trim() || null,
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
                  <label className="block md:col-span-3">GoogleマップURL
                    <input type="url" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="https://maps.app.goo.gl/..." value={form.mapUrl} onChange={onComplexChange('mapUrl')} />
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
                  <label className="block">建物構造
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.buildingStructure} onChange={onComplexChange('buildingStructure')}>
                      <option value="">選択</option>
                      <option value="SRC">SRC</option>
                      <option value="RC">RC</option>
                      <option value="鉄骨造">鉄骨造</option>
                      <option value="木造">木造</option>
                    </select>
                  </label>
                  <label className="block">階数
                    <input type="number" min="1" step="1" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）5" value={form.floorCount} onChange={onComplexChange('floorCount')} />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">成約事例</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <label className="block">同住所の成約事例 - 新耐震の価格とm²単価
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）2,480万円 / 38.1万円/m²" value={form.sameAddressNewSeismicCase} onChange={onComplexChange('sameAddressNewSeismicCase')} />
                  </label>
                  <label className="block">同住所の成約事例 - 旧耐震の価格とm²単価
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）1,980万円 / 31.4万円/m²" value={form.sameAddressOldSeismicCase} onChange={onComplexChange('sameAddressOldSeismicCase')} />
                  </label>
                  <label className="block">同駅(徒歩10分圏)の成約事例 - 新耐震の価格とm²単価
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）2,980万円 / 45.0万円/m²" value={form.sameStationNewSeismicCase} onChange={onComplexChange('sameStationNewSeismicCase')} />
                  </label>
                  <label className="block">同駅(徒歩10分圏)の成約事例 - 旧耐震の価格とm²単価
                    <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="例）2,180万円 / 33.8万円/m²" value={form.sameStationOldSeismicCase} onChange={onComplexChange('sameStationOldSeismicCase')} />
                  </label>
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
                        {marketDealsOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <div className="mt-1 text-xs text-gray-500">
                        {marketDealsAuto.value === 'unregistered'
                          ? '該当団地の過去成約情報が登録されていません'
                          : `直近3年 ${marketDealsAuto.contractCount}件 / 年平均 ${marketDealsAuto.averagePerYear?.toFixed(2) ?? '—'}件 / 戸数比 ${marketDealsAuto.ratioPerUnit != null ? `${(marketDealsAuto.ratioPerUnit * 100).toFixed(2)}%` : '—'}`}
                      </div>
                    </label>
                    <label className="block">賃貸需要
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.rentDemand} onChange={onEvalChange('rentDemand')}>
                        {evalOptions.rentDemand.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">需要指数 <span className="text-xs text-gray-500">※売れやすさの指標(直近1年の成約件数÷現在の在庫数)</span>
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
                    <label className="block">生活利便性(スーパー、病院、学校、公園の有無)
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
                    <label className="block">行政による住み替え促進・まちづくりプレイヤーの活動
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.focus} onChange={onEvalChange('focus')}>
                        {evalOptions.focus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">高齢者支援等住民サービスの充実度
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={evalForm.support} onChange={onEvalChange('support')}>
                        {evalOptions.support.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <div className="pt-2 border-t mt-2">
                      <label className="block text-sm">総合コメント
                        <textarea rows={3} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="メモ／定性的な補足" value={evalForm.comment} onChange={onEvalChange('comment')} />
                      </label>
                    </div>
                    <div className="pt-3">
                      <div className="text-sm font-medium text-gray-700">参考値（状態別㎡単価）</div>
                      <div className="mt-1 text-xs text-gray-500 space-y-1">
                        <div>計算式:</div>
                        <div>`max` = 各状態に属する過去成約の㎡単価の最大値</div>
                        <div>`mean` = 各状態に属する過去成約の㎡単価の平均値</div>
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left">状態</th>
                              <th className="px-3 py-2 text-right">max</th>
                              <th className="px-3 py-2 text-right">mean</th>
                            </tr>
                          </thead>
                          <tbody>
                            {conditionSummaries.map((summary) => (
                              <tr key={summary.key} className="border-t border-gray-200">
                                <td className="px-3 py-2">{summary.label}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatUnitPrice(summary.max)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatUnitPrice(summary.mean)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="pt-3">
                      <div className="text-sm font-medium text-gray-700">参考値（階数別㎡単価・係数）</div>
                      <div className="mt-1 text-xs text-gray-500 space-y-1">
                        <div>計算式:</div>
                        <div>`max` = 各階の過去成約㎡単価の最大値</div>
                        <div>`mean` = 各階の過去成約㎡単価の平均値</div>
                        <div>`係数` = 1階は1固定、2階以上は `mean ÷ 200000`</div>
                        <div>注意: 1階は 平均㎡単価20万とする（固定）</div>
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left">階数</th>
                              <th className="px-3 py-2 text-right">max</th>
                              <th className="px-3 py-2 text-right">mean</th>
                              <th className="px-3 py-2 text-right">係数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {floorSummaries.map((summary) => (
                              <tr key={summary.floor} className="border-t border-gray-200">
                                <td className="px-3 py-2">{summary.floor}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatUnitPrice(summary.max)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatUnitPrice(summary.mean)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {summary.coef != null ? summary.coef.toLocaleString('ja-JP', { minimumFractionDigits: summary.floor === 1 ? 0 : 2, maximumFractionDigits: 2 }) : '—'}
                                </td>
                              </tr>
                            ))}
                            {floorSummaries.length === 0 && (
                              <tr className="border-t border-gray-200">
                                <td className="px-3 py-2 text-gray-500" colSpan={4}>階数別参考値はありません。</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
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
