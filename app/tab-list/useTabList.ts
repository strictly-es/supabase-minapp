'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  applyDraftToRow,
  buildLabelSpecificResetPayload,
  draftEqualsRow,
  rowToDraft,
  type EntryDraft,
} from '@/lib/entryDrafts'
import {
  effectivePrice,
  elevatorChoiceToDb,
  monthToDateOrNull,
  toDateOrNull,
  toFloatOrNull,
  toIntOrNull,
} from '@/lib/entryMath'
import {
  createEntryPdfSignedUrl,
  hasEntryKindConflict,
  listTabListComplexes,
  listTabListEntries,
  softDeleteTabListEntry,
  updateTabListEntry,
} from '@/lib/repositories/tabList'
import { getSupabase } from '@/lib/supabaseClient'
import {
  parseDate,
  statusLabel,
  toErrorMessage,
  type ComplexOption,
  type EntryRow,
  type LabelFilter,
  type SortDirection,
  type SortKey,
} from './tabListShared'

export function useTabList() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()

  const [complexes, setComplexes] = useState<ComplexOption[]>([])
  const [selectedComplexId, setSelectedComplexId] = useState('')
  const [loadingComplexes, setLoadingComplexes] = useState(false)

  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [msg, setMsg] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('contract_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')

  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    async function loadComplexes() {
      setLoadingComplexes(true)
      try {
        const list = await listTabListComplexes(supabase)
        if (!mounted) return
        setComplexes(list)
        const requested = searchParams?.get('complexId') ?? ''
        setSelectedComplexId((prev) => {
          if (requested && list.some((item) => item.id === requested)) return requested
          if (prev && list.some((item) => item.id === prev)) return prev
          return list[0]?.id ?? ''
        })
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('団地一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingComplexes(false)
      }
    }
    loadComplexes()
    return () => { mounted = false }
  }, [supabase, searchParams])

  useEffect(() => {
    if (!selectedComplexId) return
    let mounted = true
    async function loadEntries() {
      setLoadingEntries(true)
      setMsg('')
      try {
        const data = await listTabListEntries(supabase, selectedComplexId)
        if (mounted) {
          setEntries(data as EntryRow[])
          setDrafts({})
        }
      } catch (e) {
        console.error(e)
        if (mounted) setMsg('成約一覧の取得に失敗しました: ' + toErrorMessage(e))
      } finally {
        if (mounted) setLoadingEntries(false)
      }
    }
    loadEntries()
    return () => { mounted = false }
  }, [supabase, selectedComplexId, reloadKey])

  const selectedComplex = useMemo(
    () => complexes.find((complex) => complex.id === selectedComplexId) ?? null,
    [complexes, selectedComplexId],
  )

  const displayEntries = useMemo(
    () => entries.map((row) => applyDraftToRow(row, drafts[row.id])),
    [drafts, entries],
  )

  const filteredAndSorted = useMemo(() => {
    const filtered = displayEntries.filter((row) => {
      if (labelFilter === 'all') return true
      if (labelFilter === 'none') return row.contract_kind == null
      return row.contract_kind === labelFilter
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'contract_price') {
        const av = effectivePrice(a) ?? Number.NEGATIVE_INFINITY
        const bv = effectivePrice(b) ?? Number.NEGATIVE_INFINITY
        return av - bv
      }
      if (sortKey === 'contract_date') {
        const av = parseDate(a.contract_date)?.getTime() ?? Number.NEGATIVE_INFINITY
        const bv = parseDate(b.contract_date)?.getTime() ?? Number.NEGATIVE_INFINITY
        return av - bv
      }
      if (sortKey === 'condition_status') {
        return statusLabel(a.condition_status).localeCompare(statusLabel(b.condition_status), 'ja')
      }
      const av = typeof a.floor === 'number' ? a.floor : Number.NEGATIVE_INFINITY
      const bv = typeof b.floor === 'number' ? b.floor : Number.NEGATIVE_INFINITY
      return av - bv
    })

    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [displayEntries, labelFilter, sortKey, sortDirection])

  const headerMsg = useMemo(() => {
    if (loadingComplexes || loadingEntries) return '読み込み中...'
    if (msg) return msg
    return `全${filteredAndSorted.length}件`
  }, [loadingComplexes, loadingEntries, msg, filteredAndSorted.length])

  async function handleDelete(entryId: string) {
    const ok = window.confirm('この過去成約を削除しますか？')
    if (!ok) return
    setDeletingId(entryId)
    setMsg('削除中...')
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) throw new Error('ログインが必要です')
      await softDeleteTabListEntry(supabase, entryId, user.id)
      setMsg('削除しました')
      setReloadKey((key) => key + 1)
    } catch (e) {
      console.error('[entries:delete]', e)
      setMsg('削除に失敗しました: ' + toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  function handleDraftChange(entryId: string, key: keyof EntryDraft) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value
      setDrafts((prev) => {
        const row = entries.find((item) => item.id === entryId)
        if (!row) return prev
        const next = { ...(prev[entryId] ?? rowToDraft(row)), [key]: value } as EntryDraft
        return { ...prev, [entryId]: next }
      })
    }
  }

  function handleResetDraft(entryId: string) {
    setDrafts((prev) => {
      if (!(entryId in prev)) return prev
      const next = { ...prev }
      delete next[entryId]
      return next
    })
  }

  async function handleSave(entryId: string) {
    const original = entries.find((row) => row.id === entryId)
    const draft = drafts[entryId]
    if (!original || !draft || !selectedComplex) return
    if (draftEqualsRow(draft, original)) {
      handleResetDraft(entryId)
      return
    }

    setSavingId(entryId)
    setMsg('')
    try {
      if (draft.contract_kind) {
        const hasConflict = await hasEntryKindConflict(supabase, selectedComplex.id, draft.contract_kind, entryId)
        if (hasConflict) {
          setMsg(`${draft.contract_kind}ラベルは同じ団地内で1件のみ指定できます`)
          return
        }
      }

      const price = toIntOrNull(draft.contract_price)
      const label = draft.contract_kind || null
      const nextRow = applyDraftToRow(original, draft)
      const payload = {
        estate_name: selectedComplex.name,
        complex_id: selectedComplex.id,
        has_elevator: elevatorChoiceToDb(draft.has_elevator),
        built_month: monthToDateOrNull(draft.built_month),
        building_no: toIntOrNull(draft.building_no),
        floor: toIntOrNull(draft.floor),
        contract_price: price,
        max_price: label === 'MAX' ? price : null,
        past_min: label === 'MINI' ? price : null,
        area_sqm: toFloatOrNull(draft.area_sqm),
        unit_price: nextRow.unit_price,
        reins_registered_date: toDateOrNull(draft.reins_registered_date),
        contract_date: toDateOrNull(draft.contract_date),
        condition_status: draft.condition_status || null,
        contract_kind: label,
        ...buildLabelSpecificResetPayload(original.contract_kind, draft.contract_kind),
      }

      await updateTabListEntry(supabase, entryId, payload)

      setEntries((prev) => prev.map((row) => (row.id === entryId ? nextRow : row)))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[entryId]
        return next
      })
      setMsg('更新しました')
    } catch (e) {
      console.error('[entries:update]', e)
      setMsg('更新に失敗しました: ' + toErrorMessage(e))
    } finally {
      setSavingId(null)
    }
  }

  async function handleOpenPdf(entryId: string, path: string | null) {
    if (!path) return
    setOpeningPdfId(entryId)
    try {
      const signedUrl = await createEntryPdfSignedUrl(supabase, path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('[entries:pdf]', e)
      setMsg('PDF表示に失敗しました: ' + toErrorMessage(e))
    } finally {
      setOpeningPdfId(null)
    }
  }

  const locationText = useMemo(() => {
    if (!selectedComplex) return '—'
    return [selectedComplex.pref ?? '', selectedComplex.city ?? '', selectedComplex.town ?? ''].filter(Boolean).join(' ') || '—'
  }, [selectedComplex])

  const stationText = useMemo(() => selectedComplex?.stationName ?? '—', [selectedComplex])
  const stationWalkText = useMemo(() => {
    if (!selectedComplex || selectedComplex.stationMinutes == null) return '—'
    return `${selectedComplex.stationAccessType ?? '徒歩'}${selectedComplex.stationMinutes}分`
  }, [selectedComplex])

  return {
    supabase,
    complexes,
    selectedComplex,
    selectedComplexId,
    loadingComplexes,
    entries,
    filteredAndSorted,
    drafts,
    loadingEntries,
    labelFilter,
    sortKey,
    sortDirection,
    headerMsg,
    locationText,
    stationText,
    stationWalkText,
    openingPdfId,
    deletingId,
    savingId,
    setSelectedComplexId,
    setLabelFilter,
    setSortKey,
    setSortDirection,
    handleDraftChange,
    handleResetDraft,
    handleSave,
    handleDelete,
    handleOpenPdf,
  }
}
