import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { ESTIMATE_STATUSES, UNITS } from '../lib/constants.js'
import { estimateTotals, fmtMoney } from '../lib/format.js'
import { PageHeader, Empty } from './ui.jsx'
import { Icon } from './Icon.jsx'

// Common line items to speed things up. Prices left blank on purpose.
const PRESETS = [
  { description: 'Paver patio (base, sand, pavers, install)', unit: 'sq ft' },
  { description: 'Retaining wall (block, gravel, drainage)', unit: 'sq ft' },
  { description: 'Concrete flatwork', unit: 'sq ft' },
  { description: 'Artificial turf install', unit: 'sq ft' },
  { description: 'Landscape lighting fixture', unit: 'ea' },
  { description: 'Lighting transformer + wiring', unit: 'lump sum' },
  { description: 'French drain', unit: 'ln ft' },
  { description: 'Plants / shrubs', unit: 'ea' },
  { description: 'Mulch', unit: 'yd³' },
  { description: 'Excavation / demo / haul off', unit: 'lump sum' },
  { description: 'Labor', unit: 'hr' },
]

const newItem = (extra = {}) => ({
  id: crypto.randomUUID(),
  description: '',
  qty: 1,
  unit: '',
  unit_price: 0,
  ...extra,
})

export default function EstimateEditor() {
  const { id } = useParams()
  const { contacts, showToast } = useStore()
  const nav = useNavigate()
  const [est, setEst] = useState(null)
  const [items, setItems] = useState([])
  const [origIds, setOrigIds] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    supabase
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (!data) return setMissing(true)
        const its = (data.estimate_items || []).sort((a, b) => a.position - b.position)
        delete data.estimate_items
        setEst(data)
        setItems(its.length ? its : [newItem()])
        setOrigIds(its.map((i) => i.id))
      })
    return () => {
      alive = false
    }
  }, [id])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const h = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const totals = useMemo(() => estimateTotals(items, est?.tax_rate), [items, est?.tax_rate])

  if (missing)
    return (
      <div className="page">
        <PageHeader title="Estimate" back="/clients" />
        <Empty title="This estimate doesn't exist anymore." />
      </div>
    )
  if (!est) return <div className="page"><div className="splash inline"><div className="spinner" /></div></div>

  const contact = contacts.find((c) => c.id === est.contact_id)

  const setField = (k, v) => {
    setEst((e) => ({ ...e, [k]: v }))
    setDirty(true)
  }
  const setItem = (iid, k, v) => {
    setItems((list) => list.map((it) => (it.id === iid ? { ...it, [k]: v } : it)))
    setDirty(true)
  }
  const addItem = (extra) => {
    setItems((list) => [...list, newItem(extra)])
    setDirty(true)
  }
  const removeItem = (iid) => {
    setItems((list) => list.filter((it) => it.id !== iid))
    setDirty(true)
  }
  const move = (iid, dir) => {
    setItems((list) => {
      const i = list.findIndex((x) => x.id === iid)
      const j = i + dir
      if (j < 0 || j >= list.length) return list
      const copy = list.slice()
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
    setDirty(true)
  }

  async function save() {
    setBusy(true)
    const clean = items
      .filter((it) => it.description.trim() || Number(it.unit_price))
      .map((it, i) => ({
        id: it.id,
        estimate_id: est.id,
        description: it.description.trim(),
        qty: Number(it.qty) || 0,
        unit: it.unit || null,
        unit_price: Number(it.unit_price) || 0,
        position: i,
      }))
    const e1 = await supabase
      .from('estimates')
      .update({
        title: est.title.trim() || 'Estimate',
        status: est.status,
        tax_rate: Number(est.tax_rate) || 0,
        notes: est.notes?.trim() || null,
      })
      .eq('id', est.id)
    const removed = origIds.filter((oid) => !clean.some((c) => c.id === oid))
    const e2 = removed.length ? await supabase.from('estimate_items').delete().in('id', removed) : {}
    const e3 = clean.length ? await supabase.from('estimate_items').upsert(clean) : {}
    setBusy(false)
    const err = e1.error || e2.error || e3.error
    if (err) {
      showToast('Save failed: ' + err.message)
      return false
    }
    setOrigIds(clean.map((c) => c.id))
    setDirty(false)
    showToast('Estimate saved')
    return true
  }

  async function openPrint() {
    if (dirty && !(await save())) return
    nav(`/estimates/${est.id}/print`)
  }

  async function del() {
    if (!window.confirm('Delete this estimate?')) return
    const { error } = await supabase.from('estimates').delete().eq('id', est.id)
    if (error) return showToast(error.message)
    setDirty(false)
    showToast('Estimate deleted')
    nav(contact ? `/contacts/${contact.id}` : '/clients', { replace: true })
  }

  function back() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    nav(contact ? `/contacts/${contact.id}` : -1)
  }

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="page-head-text">
          <h1>Estimate #{est.number}</h1>
          <div className="muted small">{contact?.name}</div>
        </div>
        <div className="page-head-right">
          <button className="icon-btn" onClick={openPrint} aria-label="Print or PDF">
            <Icon name="print" />
          </button>
        </div>
      </header>

      <div className="page-body form estimate-body">
        <label className="field">
          <span>Project title</span>
          <input value={est.title} onChange={(e) => setField('title', e.target.value)} />
        </label>
        <div className="field">
          <span>Status</span>
          <div className="seg">
            {ESTIMATE_STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={'seg-btn' + (est.status === s.key ? ' on' : '')}
                style={{ '--c': s.color }}
                onClick={() => setField('status', s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section-title mt">Line items</div>
        <div className="items">
          {items.map((it, i) => (
            <div key={it.id} className="item card">
              <div className="row gap-sm">
                <input
                  className="grow"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => setItem(it.id, 'description', e.target.value)}
                />
                <button className="icon-btn sm" onClick={() => removeItem(it.id)} aria-label="Remove item">
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="item-nums">
                <label>
                  <span>Qty</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={it.qty}
                    onChange={(e) => setItem(it.id, 'qty', e.target.value)}
                  />
                </label>
                <label>
                  <span>Unit</span>
                  <select value={it.unit || ''} onChange={(e) => setItem(it.id, 'unit', e.target.value)}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u || '—'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Price</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={it.unit_price}
                    onChange={(e) => setItem(it.id, 'unit_price', e.target.value)}
                  />
                </label>
                <div className="line-total">
                  <span>Total</span>
                  <b>{fmtMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</b>
                </div>
              </div>
              {items.length > 1 && (
                <div className="row gap-sm item-move">
                  <button className="btn xs" disabled={i === 0} onClick={() => move(it.id, -1)}>
                    ↑
                  </button>
                  <button className="btn xs" disabled={i === items.length - 1} onClick={() => move(it.id, 1)}>
                    ↓
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="row gap-sm wrap">
          <button className="btn" onClick={() => addItem()}>
            <Icon name="plus" size={16} /> Add line
          </button>
          <select
            className="preset-select"
            value=""
            onChange={(e) => {
              const p = PRESETS[Number(e.target.value)]
              if (p) addItem({ ...p })
            }}
          >
            <option value="">+ Common item…</option>
            {PRESETS.map((p, i) => (
              <option key={i} value={i}>
                {p.description}
              </option>
            ))}
          </select>
        </div>

        <div className="card totals">
          <div className="row between">
            <span>Subtotal</span>
            <span>{fmtMoney(totals.subtotal)}</span>
          </div>
          <div className="row between">
            <label className="row gap-sm">
              Tax
              <input
                className="tax-input"
                type="number"
                inputMode="decimal"
                step="any"
                value={est.tax_rate}
                onChange={(e) => setField('tax_rate', e.target.value)}
              />
              %
            </label>
            <span>{fmtMoney(totals.tax)}</span>
          </div>
          <div className="row between grand">
            <span>Total</span>
            <span>{fmtMoney(totals.total)}</span>
          </div>
        </div>

        <label className="field">
          <span>Notes / terms (printed on the estimate)</span>
          <textarea
            rows={4}
            value={est.notes || ''}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="50% deposit to schedule, balance due on completion. Estimate good for 30 days."
          />
        </label>

        <button className="btn danger-link" onClick={del}>
          <Icon name="trash" size={16} /> Delete estimate
        </button>
      </div>

      <div className="save-bar">
        <div>
          <div className="tiny muted">{dirty ? 'Unsaved changes' : 'All saved'}</div>
          <b>{fmtMoney(totals.total)}</b>
        </div>
        <button className="btn primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
