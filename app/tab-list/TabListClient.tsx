'use client'

import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import UserEmail from '@/components/UserEmail'
import { TabListFilters } from './TabListFilters'
import { TabListTable } from './TabListTable'
import { useTabList } from './useTabList'

export default function TabListClient() {
  const {
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
  } = useTabList()

  return (
    <RequireAuth>
      <div className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">DX</div>
              <div>
                <h1 className="text-lg font-semibold">過去成約一覧（団地別）</h1>
                <p className="text-xs text-gray-500">1成約1行で全件を表示・並び替え</p>
              </div>
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
              <li><Link href="/tab-complex" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">団地基本情報</Link></li>
              <li><Link href="/tab-regist" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">過去成約登録</Link></li>
              <li><span className="tabbtn px-3 py-1.5 rounded-lg bg-black text-white">過去成約一覧</span></li>
              <li><Link href="/tab-stock-reg" className="tabbtn px-3 py-1.5 rounded-lg bg-gray-200">在庫登録</Link></li>
            </ul>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <section className="tab active">
            <div className="bg-white rounded-2xl shadow p-5 space-y-5">
              <TabListFilters
                complexes={complexes}
                selectedComplex={selectedComplex}
                selectedComplexId={selectedComplexId}
                loadingComplexes={loadingComplexes}
                labelFilter={labelFilter}
                sortKey={sortKey}
                sortDirection={sortDirection}
                headerMsg={headerMsg}
                locationText={locationText}
                stationText={stationText}
                stationWalkText={stationWalkText}
                onSelectComplex={setSelectedComplexId}
                onChangeLabelFilter={setLabelFilter}
                onChangeSortKey={setSortKey}
                onChangeSortDirection={setSortDirection}
              />

              <TabListTable
                entries={entries}
                filteredAndSorted={filteredAndSorted}
                drafts={drafts}
                selectedComplex={selectedComplex}
                locationText={locationText}
                stationText={stationText}
                stationWalkText={stationWalkText}
                openingPdfId={openingPdfId}
                deletingId={deletingId}
                savingId={savingId}
                loadingEntries={loadingEntries}
                onDraftChange={handleDraftChange}
                onResetDraft={handleResetDraft}
                onSave={(entryId: string) => { handleSave(entryId).catch(console.error) }}
                onDelete={(entryId: string) => { handleDelete(entryId).catch(console.error) }}
                onOpenPdf={(entryId: string, path: string | null) => { handleOpenPdf(entryId, path).catch(console.error) }}
              />

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link className="underline text-blue-700" href="/tab-regist">過去成約を追加</Link>
                <Link className="underline text-blue-700" href={`/tab-stock?complexId=${encodeURIComponent(selectedComplexId)}`}>在庫一覧へ</Link>
                <Link className="underline text-blue-700" href="/tab-stock-reg">在庫登録へ</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  )
}
