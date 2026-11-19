import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { STATUS_BY_KEY } from '../lib/constants.js'
import { fmtDateTime, timeAgo, directionsHref } from '../lib/format.js'
import { dueLabel, followUpChoices, isDue, isOverdue } from '../lib/dates.js'
import { enqueue, isNetworkError } from '../lib/offline.js'
import { Sheet, StatusPicker, Badge, FollowUpPicker } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function DoorSheet({ door, onClose }) {
  const { contacts, upsertDoor, removeDoor, showToast, nameOf, userId, markKnockedToday, queue } = useStore()
  const nav = useNavigate()
  const [visits, setVisits] = useState(null)
  const [status, setStatus] = useState(null)
  const [followUp, setFollowUp] = useState(null)
  const [note, setNote] = useState('')
  const [editAddr, setEditAddr] = useState(false)
  const [editFollow, setEditFollow] = useState(false)
  const [address, setAddress] = useState(door.address || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const contact = contacts.find((c) => c.id === door.contact_id || c.door_id === door.id)
  const s = STATUS_BY_KEY[door.status]
  const queuedVisits = queue.filter((q) => q.visit?.door_id === door.id).map((q) => ({ ...q.visit, _pending: true }))
  const allVisits = [...queuedVisits.filter((q) => !(visits || []).some((v) => v.id === q.id)), ...(visits || [])]

  useEffect(() => {
    setAddress(door.address || '')
    setStatus(null)
    setNote('')
    setEditAddr(false)
    setEditFollow(false)
    let alive = true
    if (door._pending && !door.created_at) {
      setVisits([])
      return
    }
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

  function pickStatus(k) {
    setStatus(k)
    setErr('')
    if (k === 'come_back') setFollowUp(followUpChoices()[0].date.toISOString())
    else setFollowUp(null)
  }

  async function logKnock() {
    if (!status) {
      setErr('Pick what happened this time.')
      return
    }
    setBusy(true)
    setErr('')
    const now = new Date().toISOString()
    const visit = {
      id: crypto.randomUUID(),
      door_id: door.id,
      status,
      note: note.trim() || null,
      created_by: userId,
      created_at: now,
    }
    const patch = { status, updated_by: userId, follow_up_at: status === 'come_back' ? followUp : null }

    // This pin itself is still waiting to upload, so the knock has to wait too
    if (queue.some((q) => q.type === 'door' && q.door.id === door.id)) {
      enqueue({ type: 'knock', visit, patch })
      markKnockedToday(door.id)
      setBusy(false)
      setStatus(null)
      setNote('')
      showToast('Saved on your phone, will upload with the pin.')
      return
    }

    const v = await supabase.from('visits').insert(visit)
    if (v.error && isNetworkError(v.error)) {
      enqueue({ type: 'knock', visit, patch })
      markKnockedToday(door.id)
      setBusy(false)
      setStatus(null)
      setNote('')
      showToast('No signal. Saved on your phone, will upload automatically.')
      return
    }
    if (v.error) {
      setBusy(false)
      return setErr(v.error.message)
    }
    const d = await supabase.from('doors').update(patch).eq('id', door.id).select().single()
    setBusy(false)
    if (d.error) return setErr(d.error.message)
    upsertDoor(d.data)
    markKnockedToday(door.id)
    setVisits((list) => [visit, ...(list || [])])
    setStatus(null)
    setNote('')
    showToast('Knock logged')
    if (status === 'lead' && !contact) nav(`/contacts/new?door=${door.id}`)
  }

  async function saveFollowUp(value) {
    const { data, error } = await supabase
      .from('doors')
      .update({ follow_up_at: value })
      .eq('id', door.id)
      .select()
      .single()
    if (error) return setErr(error.message)
    upsertDoor(data)
    setEditFollow(false)
    showToast(value ? 'Revisit rescheduled' : 'Revisit cleared')
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

  const knocks = allVisits.length
  const due = door.status === 'come_back' && door.follow_up_at

  return (
    <Sheet
      title={
        <div className="row gap-sm wrap">
          <Badge color={s?.color}>{s?.label}</Badge>
          <span className="muted small">
            {timeAgo(door.updated_at)} · {nameOf(door.updated_by || door.created_by)}
          </span>
          {door._pending && <span className="badge pending">Waiting to upload</span>}
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
          {!door._pending && (
            <button className="icon-btn sm" onClick={() => setEditAddr(true)} aria-label="Edit address">
              <Icon name="edit" size={16} />
            </button>
          )}
        </div>
      )}
      {visits !== null && (
        <div className="small muted">
          Knocked {knocks} {knocks === 1 ? 'time' : 'times'}
          {knocks > 0 && ` · first ${fmtDateTime(allVisits[allVisits.length - 1].created_at)}`}
        </div>
      )}

      {due && (
        <div className={'followup-card' + (isOverdue(door.follow_up_at) ? ' overdue' : isDue(door.follow_up_at) ? ' due' : '')}>
          <div className="row between gap-sm">
            <div>
              <div className="label">Come back</div>
              <b>{dueLabel(door.follow_up_at)}</b>
            </div>
            {!door._pending && (
              <button className="btn sm" onClick={() => setEditFollow((v) => !v)}>
                {editFollow ? 'Cancel' : 'Change'}
              </button>
            )}
          </div>
          {editFollow && (
            <div className="mt-sm">
              <FollowUpPicker value={door.follow_up_at} onChange={saveFollowUp} />
            </div>
          )}
        </div>
      )}

      <div className="row gap-sm wrap">
        {contact ? (
          <button className="btn primary" onClick={() => nav(`/contacts/${contact.id}`)}>
            <Icon name={contact.stage === 'client' ? 'briefcase' : 'star'} size={16} />
            Open {contact.stage === 'client' ? 'client' : 'lead'}: {contact.name}
          </button>
        ) : (
          !door._pending && (
            <button className="btn primary" onClick={() => nav(`/contacts/new?door=${door.id}`)}>
              <Icon name="star" size={16} /> Make this a lead
            </button>
          )
        )}
        <a className="btn" href={directionsHref(door)} target="_blank" rel="noreferrer">
          <Icon name="nav" size={16} /> Directions
        </a>
      </div>

      <div className="section">
        <div className="section-title">Log another knock</div>
        <StatusPicker value={status} onChange={pickStatus} disabled={busy} />
        {status === 'come_back' && (
          <div className="field mt-sm">
            <span>When should we come back?</span>
            <FollowUpPicker value={followUp} onChange={setFollowUp} allowClear={false} />
          </div>
        )}
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
        {visits !== null && knocks === 0 && door.notes && <div className="visit">{door.notes}</div>}
        {allVisits.map((v) => (
          <div key={v.id} className="visit">
            <div className="row gap-sm wrap">
              <span className="dot" style={{ background: STATUS_BY_KEY[v.status]?.color }} />
              <b>{STATUS_BY_KEY[v.status]?.label}</b>
              <span className="muted small">
                {fmtDateTime(v.created_at)} · {nameOf(v.created_by)}
              </span>
              {v._pending && <span className="badge pending">Waiting to upload</span>}
            </div>
            {v.note && <div className="visit-note">{v.note}</div>}
          </div>
        ))}
      </div>

      {!door._pending && (
        <button className="btn danger-link mt" onClick={del}>
          <Icon name="trash" size={16} /> Delete pin
        </button>
      )}
    </Sheet>
  )
}
