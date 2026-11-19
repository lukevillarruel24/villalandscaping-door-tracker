import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { SERVICES, SOURCES, STAGE_BY_KEY } from '../lib/constants.js'
import { PageHeader, Badge } from './ui.jsx'
import { Icon } from './Icon.jsx'

// Start an estimate in one step: pick an existing customer, or type a new one
// (the lead is created behind the scenes).
export default function QuickEstimate() {
  const [params] = useSearchParams()
  const fromClients = params.get('stage') === 'client'
  const { contacts, upsertContact, showToast, userId } = useStore()
  const nav = useNavigate()
  const [mode, setMode] = useState('new')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ name: '', phone: '', address: '', source: '', services: [] })
  const [isClient, setIsClient] = useState(fromClients)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    return contacts
      .filter((c) => c.stage !== 'lost')
      .filter(
        (c) => !term || [c.name, c.address, c.phone].filter(Boolean).some((v) => v.toLowerCase().includes(term)),
      )
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 30)
  }, [contacts, q])

  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }))
  const toggleService = (s) =>
    setF((cur) => ({
      ...cur,
      services: cur.services.includes(s) ? cur.services.filter((x) => x !== s) : [...cur.services, s],
    }))

  async function startFor(contact) {
    setBusy(true)
    const title = contact.services?.length ? contact.services.join(' + ') : 'Landscape project'
    const { data, error } = await supabase
      .from('estimates')
      .insert({ contact_id: contact.id, title, created_by: userId })
      .select()
      .single()
    setBusy(false)
    if (error) return setErr(error.message)
    nav(`/estimates/${data.id}`, { replace: true })
  }

  async function createAndStart(e) {
    e.preventDefault()
    if (!f.name.trim()) return setErr('Add the customer’s name.')
    setBusy(true)
    setErr('')
    const now = new Date().toISOString()
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        source: f.source || null,
        services: f.services,
        stage: isClient ? 'client' : 'lead',
        converted_at: isClient ? now : null,
        created_by: userId,
      })
      .select()
      .single()
    if (error) {
      setBusy(false)
      return setErr(error.message)
    }
    upsertContact(contact)
    showToast(`${contact.name} added as a ${isClient ? 'client' : 'lead'}`)
    await startFor(contact)
  }

  return (
    <div className="page">
      <PageHeader title="New estimate" back={fromClients ? '/clients' : '/leads'} />
      <div className="page-body">
        <div className="seg">
          <button className={'seg-btn' + (mode === 'new' ? ' on' : '')} onClick={() => setMode('new')}>
            New customer
          </button>
          <button className={'seg-btn' + (mode === 'existing' ? ' on' : '')} onClick={() => setMode('existing')}>
            Existing customer
          </button>
        </div>

        {mode === 'new' ? (
          <form className="form mt" onSubmit={createAndStart}>
            <label className="field">
              <span>Customer name *</span>
              <input value={f.name} onChange={set('name')} autoComplete="off" autoFocus />
            </label>
            <label className="field">
              <span>Phone</span>
              <input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
            </label>
            <label className="field">
              <span>Job address</span>
              <input value={f.address} onChange={set('address')} placeholder="123 Main St, Calhoun, GA" />
            </label>
            <div className="field">
              <span>What's the job?</span>
              <div className="chip-row">
                {SERVICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={'chip toggle' + (f.services.includes(s) ? ' on' : '')}
                    onClick={() => toggleService(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>How did they find us?</span>
              <div className="chip-row">
                {SOURCES.filter((s) => s !== 'Door knock').map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={'chip toggle' + (f.source === s ? ' on' : '')}
                    onClick={() => setF((cur) => ({ ...cur, source: cur.source === s ? '' : s }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={isClient} onChange={(e) => setIsClient(e.target.checked)} />
              They've already hired us (add as a client, not a lead)
            </label>
            {err && <p className="form-error">{err}</p>}
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Starting…' : 'Start estimate'}
            </button>
            <p className="tiny muted center">
              They'll be saved under {isClient ? 'Clients' : 'Leads'} so you can add notes and photos later.
            </p>
          </form>
        ) : (
          <div className="mt">
            <div className="search-bar flat">
              <Icon name="search" size={18} />
              <input placeholder="Search name, address, phone" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            {err && <p className="form-error">{err}</p>}
            <div className="list">
              {matches.length === 0 && <div className="muted small pad">No matches. Use "New customer" instead.</div>}
              {matches.map((c) => (
                <button key={c.id} className="list-item as-btn" disabled={busy} onClick={() => startFor(c)}>
                  <div className="list-main">
                    <div className="row gap-sm">
                      <b>{c.name}</b>
                      <Badge color={STAGE_BY_KEY[c.stage]?.color}>{STAGE_BY_KEY[c.stage]?.label}</Badge>
                    </div>
                    {c.address && <div className="small muted">{c.address}</div>}
                  </div>
                  <Icon name="plus" size={18} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
