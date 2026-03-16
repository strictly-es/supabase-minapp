import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyDraftToRow,
  buildLabelSpecificResetPayload,
  draftEqualsRow,
  rowToDraft,
  type EntryDraft,
  type EntryDraftRow,
} from './entryDrafts.ts'

const baseRow: EntryDraftRow = {
  contract_kind: 'MAX',
  has_elevator: true,
  built_month: '2020-04-01',
  building_no: 12,
  floor: 3,
  contract_price: null,
  area_sqm: 65.5,
  reins_registered_date: '2026-03-01',
  contract_date: '2026-03-12',
  condition_status: 'OWNER_OCCUPIED',
  max_price: 29_800_000,
  past_min: null,
  unit_price: null,
}

test('rowToDraft exposes editable strings using effective price fallback', () => {
  assert.deepEqual(rowToDraft(baseRow), {
    contract_kind: 'MAX',
    has_elevator: 'あり',
    built_month: '2020-04',
    building_no: '12',
    floor: '3',
    contract_price: '29800000',
    area_sqm: '65.5',
    reins_registered_date: '2026-03-01',
    contract_date: '2026-03-12',
    condition_status: 'OWNER_OCCUPIED',
  })
})

test('draftEqualsRow detects unchanged drafts', () => {
  const draft = rowToDraft(baseRow)
  assert.equal(draftEqualsRow(draft, baseRow), true)
  assert.equal(draftEqualsRow({ ...draft, floor: '4' }, baseRow), false)
})

test('applyDraftToRow switches MAX to MINI payload shape and recomputes unit price', () => {
  const draft: EntryDraft = {
    contract_kind: 'MINI',
    has_elevator: 'なし',
    built_month: '2019-02',
    building_no: '8',
    floor: '2',
    contract_price: '19800000',
    area_sqm: '54',
    reins_registered_date: '2026-02-01',
    contract_date: '2026-02-20',
    condition_status: 'PARTIAL_REFORM',
  }

  const applied = applyDraftToRow(baseRow, draft)
  assert.equal(applied.contract_kind, 'MINI')
  assert.equal(applied.has_elevator, false)
  assert.equal(applied.built_month, '2019-02-01')
  assert.equal(applied.max_price, null)
  assert.equal(applied.past_min, 19_800_000)
  assert.equal(applied.unit_price, 366666.67)
})

test('buildLabelSpecificResetPayload clears label-specific columns on transitions', () => {
  assert.deepEqual(buildLabelSpecificResetPayload('MAX', 'MAX'), {})
  assert.deepEqual(buildLabelSpecificResetPayload('MINI', 'MAX'), { renovated: null })
  assert.deepEqual(buildLabelSpecificResetPayload('MAX', 'MINI'), {
    coef_total: null,
    interior_level_coef: null,
    contract_year_coef: null,
  })
  assert.deepEqual(buildLabelSpecificResetPayload('MAX', ''), {
    coef_total: null,
    interior_level_coef: null,
    contract_year_coef: null,
    renovated: null,
  })
})
