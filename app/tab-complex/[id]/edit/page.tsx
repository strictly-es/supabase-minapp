'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import { calcBuiltAge, calcComplexMonthlyCostTotal, parseMonthlyAmount } from '@/lib/complexForm'
import { insertComplexEvaluation, updateComplex } from '@/lib/repositories/complexes'
import {
  countComplexContractsSince,
  loadComplexEditSnapshot,
  loadComplexReferenceSummaries,
} from '@/lib/repositories/complexEdit'
import type { ReferenceValueEntry } from '@/lib/referenceValue'
import { getSupabase } from '@/lib/supabaseClient'
import { ComplexBasicsSection } from './ComplexBasicsSection'
import { ComplexEvaluationSection } from './ComplexEvaluationSection'
import {
  type Access,
  type ComplexForm,
  type EvalOption,
  type EvalState,
  type MarketDealsAutoState,
  type MarketDealsValue,
  type Pref,
} from './complexEditShared'

type StoredOption = { value?: string; label?: string; score?: number }
type StoredFactors = {
  market?: { deals?: StoredOption; rentDemand?: StoredOption; inventory?: StoredOption }
  location?: { walk?: StoredOption; access?: StoredOption; convenience?: StoredOption }
  building?: { scale?: StoredOption; elevator?: StoredOption; mgmt?: StoredOption; appearance?: StoredOption; parking?: StoredOption; view?: StoredOption }
  plus?: { future?: StoredOption; focus?: StoredOption; support?: StoredOption }
}

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
  mgmtFee: '',
  repairReserveFee: '',
  otherMonthlyFee: '',
  rentCaseAvailability: '',
  rentCaseMaxMonthlyRent: '',
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
  const [marketDealsAuto, setMarketDealsAuto] = useState<MarketDealsAutoState>({
    value: 'unregistered',
    contractCount: 0,
    averagePerYear: null,
    ratioPerUnit: null,
  })
  const [referenceRows, setReferenceRows] = useState<ReferenceValueEntry[]>([])
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
        const contractCount = await countComplexContractsSince(supabase, id, sinceText)
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
        const { rows } =
          await loadComplexReferenceSummaries(supabase, id)

        if (mounted) {
          setReferenceRows(rows)
        }
      } catch (e) {
        console.error('[complex/edit:condition-summary]', e)
        if (mounted) {
          setReferenceRows([])
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
        const { complex, evaluation } = await loadComplexEditSnapshot(supabase, id)
        if (!complex) {
          if (mounted) setMsg('データが見つかりません')
          return
        }
        if (mounted) {
          setForm({
            name: complex.name ?? '',
            pref: (complex.pref ?? '') as Pref,
            city: complex.city ?? '',
            town: complex.town ?? '',
            mapUrl: complex.map_url ?? '',
            builtYm: complex.built_ym ?? '',
            unitCount: typeof complex.unit_count === 'number' ? String(complex.unit_count) : '',
            stationName: complex.station_name ?? '',
            stationAccess: (complex.station_access_type ?? '') as Access,
            stationMinutes: typeof complex.station_minutes === 'number' ? String(complex.station_minutes) : '',
            seller: complex.seller ?? '',
            builder: complex.builder ?? '',
            mgmtCompany: complex.mgmt_company ?? '',
            mgmtType: (complex.mgmt_type ?? '') as ComplexForm['mgmtType'],
            mgmtFee: typeof complex['mgmt_fee_monthly'] === 'number' ? String(complex['mgmt_fee_monthly']) : '',
            repairReserveFee: typeof complex['repair_reserve_fee_monthly'] === 'number' ? String(complex['repair_reserve_fee_monthly']) : '',
            otherMonthlyFee: typeof complex['other_fee_monthly'] === 'number' ? String(complex['other_fee_monthly']) : '',
            rentCaseAvailability: (complex.rent_case_availability ?? '') as ComplexForm['rentCaseAvailability'],
            rentCaseMaxMonthlyRent: typeof complex.rent_case_max_monthly_rent === 'number' ? String(complex.rent_case_max_monthly_rent) : '',
            buildingStructure: (complex.building_structure ?? '') as ComplexForm['buildingStructure'],
            floorCount: typeof complex.floor_count === 'number' ? String(complex.floor_count) : '',
            sameAddressNewSeismicCase: complex.same_address_new_seismic_case ?? '',
            sameAddressOldSeismicCase: complex.same_address_old_seismic_case ?? '',
            sameStationNewSeismicCase: complex.same_station_new_seismic_case ?? '',
            sameStationOldSeismicCase: complex.same_station_old_seismic_case ?? '',
          })
        }

        if (mounted && evaluation) {
          const factors = (evaluation.factors ?? null) as StoredFactors | null
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
            comment: evaluation.note ?? '',
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
  const totalMonthlyCost = useMemo(
    () => calcComplexMonthlyCostTotal([form.mgmtFee, form.repairReserveFee, form.otherMonthlyFee]),
    [form.mgmtFee, form.repairReserveFee, form.otherMonthlyFee],
  )

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
        station_minutes: parseMonthlyAmount(form.stationMinutes),
        seller: form.seller.trim() || null,
        builder: form.builder.trim() || null,
        mgmt_company: form.mgmtCompany.trim() || null,
        mgmt_type: form.mgmtType || null,
        mgmt_fee_monthly: parseMonthlyAmount(form.mgmtFee),
        repair_reserve_fee_monthly: parseMonthlyAmount(form.repairReserveFee),
        other_fee_monthly: parseMonthlyAmount(form.otherMonthlyFee),
        rent_case_availability: form.rentCaseAvailability || null,
        rent_case_max_monthly_rent: parseMonthlyAmount(form.rentCaseMaxMonthlyRent),
        unit_count: parseMonthlyAmount(form.unitCount),
        building_structure: form.buildingStructure || null,
        floor_count: parseMonthlyAmount(form.floorCount),
        same_address_new_seismic_case: form.sameAddressNewSeismicCase.trim() || null,
        same_address_old_seismic_case: form.sameAddressOldSeismicCase.trim() || null,
        same_station_new_seismic_case: form.sameStationNewSeismicCase.trim() || null,
        same_station_old_seismic_case: form.sameStationOldSeismicCase.trim() || null,
        updated_by: user.id,
      }

      await updateComplex(supabase, id, complexPayload)

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

      await insertComplexEvaluation(supabase, {
        complex_id: id,
        total_score: totalScore,
        factors,
        note: evalForm.comment.trim() || null,
        created_by: user.id,
        updated_by: user.id,
      })

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
              <ComplexBasicsSection form={form} builtAge={builtAge} totalMonthlyCost={totalMonthlyCost} onComplexChange={onComplexChange} />
              <ComplexEvaluationSection
                evalForm={evalForm}
                evalOptions={evalOptions}
                marketDealsOptions={marketDealsOptions}
                marketDealsAuto={marketDealsAuto}
                categoryTotals={categoryTotals}
                totalScore={totalScore}
                referenceRows={referenceRows}
                maxFloor={Number.parseInt(form.floorCount, 10) || null}
                saving={saving}
                onEvalChange={onEvalChange}
              />
            </form>
          </div>
        </section>
      </main>
    </div>
    </RequireAuth>
  )
}
