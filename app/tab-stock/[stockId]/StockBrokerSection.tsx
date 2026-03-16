'use client'

import type { StockDetail } from './stockDetailShared'

type Props = {
  row: StockDetail | null
  signedUrl: string | null
}

export default function StockBrokerSection({ row, signedUrl }: Props) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">仲介不動産会社の情報</h3>
      <dl className="grid md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
        <div><dt className="text-gray-500">社名</dt><dd>{row?.broker_name || '-'}</dd></div>
        <div><dt className="text-gray-500">所在地（都道府県）</dt><dd>{row?.broker_pref || '-'}</dd></div>
        <div><dt className="text-gray-500">所在地（市）</dt><dd>{row?.broker_city || '-'}</dd></div>
        <div className="md:col-span-3"><dt className="text-gray-500">所在地（町村）</dt><dd>{row?.broker_town || '-'}</dd></div>
        <div><dt className="text-gray-500">TEL</dt><dd>{row?.broker_tel || '-'}</dd></div>
        <div><dt className="text-gray-500">担当者名</dt><dd>{row?.broker_person || '-'}</dd></div>
        <div><dt className="text-gray-500">携帯</dt><dd>{row?.broker_mobile || '-'}</dd></div>
        <div className="md:col-span-2"><dt className="text-gray-500">メールアドレス</dt><dd>{row?.broker_email || '-'}</dd></div>
        <div><dt className="text-gray-500">マイソクPDF</dt><dd>{row?.broker_mysoku_url ? <a href={row.broker_mysoku_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : (signedUrl ? <a href={signedUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く（Storage）</a> : <span className="text-gray-400">-</span>)}</dd></div>
        <div><dt className="text-gray-500">現地写真</dt><dd>{row?.broker_photo_url ? <a href={row.broker_photo_url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">開く</a> : <span className="text-gray-400">-</span>}</dd></div>
      </dl>
    </section>
  )
}
