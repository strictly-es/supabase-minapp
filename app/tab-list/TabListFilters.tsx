'use client'

import type { ComplexOption, LabelFilter, SortDirection, SortKey } from './tabListShared'

type Props = {
  complexes: ComplexOption[]
  selectedComplex: ComplexOption | null
  selectedComplexId: string
  loadingComplexes: boolean
  labelFilter: LabelFilter
  sortKey: SortKey
  sortDirection: SortDirection
  headerMsg: string
  locationText: string
  stationText: string
  stationWalkText: string
  onSelectComplex: (value: string) => void
  onChangeLabelFilter: (value: LabelFilter) => void
  onChangeSortKey: (value: SortKey) => void
  onChangeSortDirection: (value: SortDirection) => void
}

export function TabListFilters(props: Props) {
  const {
    complexes,
    selectedComplex,
    selectedComplexId,
    loadingComplexes,
    labelFilter,
    sortKey,
    sortDirection,
    headerMsg,
    locationText,
    stationText,
    stationWalkText,
    onSelectComplex,
    onChangeLabelFilter,
    onChangeSortKey,
    onChangeSortDirection,
  } = props

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm text-gray-500">対象団地</div>
          <div className="text-xl font-semibold">{selectedComplex?.name ?? '団地未選択'}</div>
          <div className="text-xs text-gray-500">{locationText} / 最寄: {stationText} / {stationWalkText}</div>
        </div>
        <span className="flex-1" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">団地
            <select
              className="border rounded-lg px-2 py-1"
              value={selectedComplexId}
              onChange={(e) => onSelectComplex(e.target.value)}
              disabled={loadingComplexes}
            >
              {complexes.map((complex) => (
                <option key={complex.id} value={complex.id}>
                  {complex.name} {complex.pref ?? ''}{complex.city ? ` ${complex.city}` : ''}
                </option>
              ))}
              {complexes.length === 0 && <option value="">団地なし</option>}
            </select>
          </label>
          <label className="flex items-center gap-1">ラベル
            <select className="border rounded-lg px-2 py-1" value={labelFilter} onChange={(e) => onChangeLabelFilter(e.target.value as LabelFilter)}>
              <option value="all">すべて</option>
              <option value="MAX">MAX</option>
              <option value="MINI">MINI</option>
              <option value="none">ラベルなし</option>
            </select>
          </label>
          <label className="flex items-center gap-1">並び替え
            <select className="border rounded-lg px-2 py-1" value={sortKey} onChange={(e) => onChangeSortKey(e.target.value as SortKey)}>
              <option value="contract_price">成約価格</option>
              <option value="contract_date">成約年月日</option>
              <option value="condition_status">状態</option>
              <option value="floor">階数</option>
            </select>
          </label>
          <label className="flex items-center gap-1">順序
            <select className="border rounded-lg px-2 py-1" value={sortDirection} onChange={(e) => onChangeSortDirection(e.target.value as SortDirection)}>
              <option value="desc">降順</option>
              <option value="asc">昇順</option>
            </select>
          </label>
        </div>
      </div>

      <div className="text-sm text-gray-500">{headerMsg}</div>
    </>
  )
}
