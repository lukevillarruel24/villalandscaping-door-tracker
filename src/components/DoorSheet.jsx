import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { STATUS_BY_KEY } from '../lib/constants.js'
import { fmtDateTime, timeAgo, directionsHref } from '../lib/format.js'
import { Sheet, StatusPicker, Badge } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function DoorSheet({ door, onClose }) {
  const { contacts, upsertDoor, removeDoor, showToast, nameOf, userId } = useStore()
  const nav = useNavigate()
  const [visits, setVisits] = useState(null)
  const [status, setStatus] = useState(null)
  const [note, setNote] = useState('')
  const [editAddr, setEditAddr] = useState(false)
  const [address, setAddress] = useState(door.address || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const contact = contacts.find((c) => c.id === door.contact_id || c.door_id === door.id)
  const s = STATUS_BY_KEY[door.status]

  useEffect(() => {
    setAddress(door.address || '')
    setStatus(null)
    setNote('')
    setEditAddr(false)
    let alive = true
    supabase
      .from('visits')
      .select('*')
      .eq('door_id', door.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => alive && setVisits(data || []))
    return () => {
      alive = false
    }
  }, [door.id])

  async function logKnock() {
    if (!status) {
      setErr('Pick what happened this time.')
      return
    }
    setBusy(true)
    setErr('')
    const v = await supabase
      .from('visits')
      .insert({ door_id: door.id, status, note: note.trim() || null, created_by: userId })
      .select()
      .single()
    const d = await supabase
      .from('doors')
      .update({ status, updated_by: userId })
      .eq('id', door.id)
      .select()
      .single()
    setBusy(false)
    if (v.error || d.error) {
      setErr((v.error || d.error).message)
      return
    }
    upsertDoor(d.data)
    setVisits((list) => [v.data, ...(list || [])])
    setStatus(null)
    setNote('')
    showToast('Knock logged')
    if (status === 'lead' && !contact) nav(`/contacts/new?door=${door.id}`)
  }

  async function saveAddress() {
    const { data, error } = await supabase
      .from('doors')
      .update({ address: address.trim() || null })
      .eq('id', door.id)
      .select()
      .single()
    if (error) return setErr(error.message)
    upsertDoor(data)
    setEditAddr(false)
  }

  async function del() {
    if (!window.confirm('Delete this pin and its knock history?')) return
    const { error } = await supabase.from('doors').delete().eq('id', door.id)
    if (error) return setErr(error.message)
    removeDoor(door.id)
    showToast('Pin deleted')
    onClose()
  }

  return (
    <Sheet
      title={
        <div className="row gap-sm wrap">
          <Badge color={s?.color}>{s?.label}</Badge>
          <span className="muted small">
            {timeAgo(door.updated_at)} · {nameOf(door.updated_by || door.created_by)}
          </span>
        </div>
      }
      onClose={onClose}
    >
      {editAddr ? (
        <div className="row gap-sm">
          <input className="grow" value={address} onChange={(e) => setAddress(e.target.value)} autoFocus />
          <button className="btn primary" onClick={saveAddress}>
            Save
          </button>
        </div>
      ) : (
        <div className="door-addr">
          <h3>{door.address || 'No address'}</h3>
          <button className="icon-btn sm" onClick={() => setEditAddr(true)} aria-label="Edit address">
            <Icon name="edit" size={16} />
          </button>
        </div>
      )}

      <div className="row gap-sm wrap mt">
        {contact ? (
          <button className="btn primary" onClick={() => nav(`/contacts/${contact.id}`)}>
            <Icon name={contact.stage === 'client' ? 'briefcase' : 'star'} size={16} />
            Open {contact.stage === 'client' ? 'client' : 'lead'}: {contact.name}
          </button>
        ) : (
          <button className="btn primary" onClick={() => nav(`/contacts/new?door=${door.id}`)}>
            <Icon name="star" size={16} /> Make this a lead
          </button>
        )}
        <a className="btn" href={directionsHref(door)} target="_blank" rel="noreferrer">
          <Icon name="nav" size={16} /> Directions
        </a>
      </div>

      <div className="section">
        <div className="section-title">Log another knock</div>
        <StatusPicker value={status} onChange={setStatus} disabled={busy} />
        {status && (
          <>
            <textarea
              rows={2}
              className="mt-sm"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn primary block mt-sm" onClick={logKnock} disabled={busy}>
              {busy ? 'Saving…' : 'Save knock'}
            </button>
          </>
        )}
        {err && <p className="form-error">{err}</p>}
      </div>

      <div className="section">
        <div className="section-title">
          <Icon name="history" size={16} /> History
        </div>
        {visits === null && <div className="muted small">Loading…</div>}
        {visits?.length === 0 && door.notes && <div className="visit">{door.notes}</div>}
        {visits?.map((v) => (
          <div key={v.id} className="visit">
            <div className="row gap-sm">
              <span className="dot" style={{ background: STATUS_BY_KEY[v.status]?.color }} />
              <b>{STATUS_BY_KEY[v.status]?.label}</b>
              <span className="muted small">
                {fmtDateTime(v.created_at)} · {nameOf(v.created_by)}
              </span>
            </div>
            {v.note && <div className="visit-note">{v.note}</div>}
          </div>
        ))}
      </div>

      <button className="btn danger-link mt" onClick={del}>
        <Icon name="trash" size={16} /> Delete pin
      </button>
    </Sheet>
  )
}
