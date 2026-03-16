'use client'

import { prefOptions, type ComplexChangeHandler, type ComplexForm, type Pref } from './complexEditShared'

type Props = {
  form: ComplexForm
  builtAge: number | null
  onComplexChange: ComplexChangeHandler
}

export function ComplexBasicsSection({ form, builtAge, onComplexChange }: Props) {
  return (
    <>
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
    </>
  )
}
