import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { SERVICES, SOURCES } from '../lib/constants.js'
import { PageHeader, FollowUpPicker } from './ui.jsx'

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  address: '',
  services: [],
  budget: '',
  best_time: '',
  notes: '',
  source: '',
  follow_up_at: null,
}

export default function ContactForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const doorId = params.get('door')
  const { contacts, doors, upsertContact, upsertDoor, showToast, userId } = useStore()
  const nav = useNavigate()
  const existing = id ? contacts.find((c) => c.id === id) : null
  const door = doorId ? doors.find((d) => d.id === doorId) : null
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (existing) {
      setF({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, existing[k] ?? EMPTY[k]])),
      })
    } else if (door) {
      setF((cur) => ({
        ...cur,
        address: cur.address || door.address || '',
        notes: cur.notes || door.notes || '',
        source: cur.source || 'Door knock',
      }))
    }
  }, [existing?.id, door?.id])

  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }))
  const toggleService = (s) =>
    setF((cur) => ({
      ...cur,
      services: cur.services.includes(s) ? cur.services.filter((x) => x !== s) : [...cur.services, s],
    }))

  async function save(e) {
    e.preventDefault()
    if (!f.name.trim()) {
      setErr('Add a name (first name is fine).')
      return
    }
    setBusy(true)
    setErr('')
    const row = {
      name: f.name.trim(),
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      address: f.address.trim() || null,
      services: f.services,
      budget: f.budget.trim() || null,
      best_time: f.best_time.trim() || null,
      notes: f.notes.trim() || null,
      source: f.source || null,
      follow_up_at: f.follow_up_at || null,
    }

    if (existing) {
      const { data, error } = await supabase.from('contacts').update(row).eq('id', existing.id).select().single()
      setBusy(false)
      if (error) return setErr(error.message)
      upsertContact(data)
      showToast('Saved')
      nav(`/contacts/${data.id}`, { replace: true })
      return
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...row,
        stage: 'lead',
        door_id: door?.id || null,
        lat: door?.lat ?? null,
        lng: door?.lng ?? null,
        created_by: userId,
      })
      .select()
      .single()
    if (error) {
      setBusy(false)
      return setErr(error.message)
    }
    upsertContact(data)
    if (door) {
      const d = await supabase
        .from('doors')
        .update({ contact_id: data.id, status: 'lead', updated_by: userId })
        .eq('id', door.id)
        .select()
        .single()
      if (!d.error) upsertDoor(d.data)
      if (door.status !== 'lead') {
        await supabase.from('visits').insert({ door_id: door.id, status: 'lead', created_by: userId })
      }
    }
    setBusy(false)
    showToast('Lead added')
    nav(`/contacts/${data.id}`, { replace: true })
  }

  return (
    <div className="page">
      <PageHeader title={existing ? 'Edit' : 'New lead'} back="/leads" />
      <form className="page-body form" onSubmit={save}>
        <label className="field">
          <span>Name *</span>
          <input value={f.name} onChange={set('name')} autoComplete="off" autoFocus={!existing} />
        </label>
        <div className="row gap-sm">
          <label className="field grow">
            <span>Phone</span>
            <input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
          </label>
          <label className="field grow">
            <span>Email</span>
            <input type="email" inputMode="email" value={f.email} onChange={set('email')} />
          </label>
        </div>
        <label className="field">
          <span>Address</span>
          <input value={f.address} onChange={set('address')} />
        </label>
        <div className="field">
          <span>Interested in</span>
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
        <div className="row gap-sm">
          <label className="field grow">
            <span>Rough budget</span>
            <input value={f.budget} onChange={set('budget')} placeholder="$5–8k" />
          </label>
          <label className="field grow">
            <span>Best time to call</span>
            <input value={f.best_time} onChange={set('best_time')} placeholder="Evenings" />
          </label>
        </div>
        <div className="field">
          <span>How did they find us?</span>
          <div className="chip-row">
            {SOURCES.map((s) => (
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
        <div className="field">
          <span>Next follow-up (optional)</span>
          <FollowUpPicker value={f.follow_up_at} onChange={(v) => setF((cur) => ({ ...cur, follow_up_at: v }))} />
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={4} value={f.notes} onChange={set('notes')} placeholder="What they want, timeline, anything said at the door" />
        </label>
        {err && <p className="form-error">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Save lead'}
        </button>
      </form>
    </div>
  )
}
