import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { reverseGeocode, distanceM } from '../lib/geo.js'
import { Sheet, StatusPicker } from './ui.jsx'

export default function NewDoorSheet({ pin, onClose, onOpenExisting }) {
  const { doors, upsertDoor, showToast, userId } = useStore()
  const nav = useNavigate()
  const [address, setAddress] = useState('')
  const [looking, setLooking] = useState(true)
  const [status, setStatus] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    reverseGeocode(pin.lat, pin.lng).then((a) => {
      if (!alive) return
      setAddress((cur) => cur || a)
      setLooking(false)
    })
    return () => {
      alive = false
    }
  }, [pin.lat, pin.lng])

  // Warn if there's already a pin right here
  const nearby = useMemo(() => {
    let best = null
    for (const d of doors) {
      const m = distanceM([pin.lat, pin.lng], [d.lat, d.lng])
      if (m < 20 && (!best || m < best.m)) best = { door: d, m }
    }
    return best
  }, [doors, pin.lat, pin.lng])

  async function save() {
    if (!status) {
      setErr('Pick what happened at the door.')
      return
    }
    setBusy(true)
    setErr('')
    const { data: door, error } = await supabase
      .from('doors')
      .insert({
        lat: pin.lat,
        lng: pin.lng,
        address: address.trim() || null,
        status,
        notes: note.trim() || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()
    if (error) {
      setErr(error.message)
      setBusy(false)
      return
    }
    await supabase.from('visits').insert({ door_id: door.id, status, note: note.trim() || null, created_by: userId })
    upsertDoor(door)
    setBusy(false)
    onClose()
    if (status === 'lead') {
      showToast('Pin saved. Add the lead details.')
      nav(`/contacts/new?door=${door.id}`)
    } else {
      showToast('Pin saved')
    }
  }

  return (
    <Sheet
      title="New door"
      onClose={onClose}
      footer={
        <button className="btn primary block" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : status === 'lead' ? 'Save and add lead info' : 'Save pin'}
        </button>
      }
    >
      {nearby && (
        <div className="notice">
          There's already a pin {Math.round(nearby.m)} m away
          {nearby.door.address ? ` (${nearby.door.address})` : ''}.{' '}
          <button className="btn link inline" onClick={() => onOpenExisting(nearby.door.id)}>
            Open that one instead
          </button>
        </div>
      )}
      <label className="field">
        <span>Address {looking && <em className="muted">looking up…</em>}</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Calhoun, GA" />
      </label>
      <div className="field">
        <span>What happened?</span>
        <StatusPicker value={status} onChange={setStatus} />
      </div>
      <label className="field">
        <span>Note (optional)</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Dog in yard, wife interested, come back Saturday…"
        />
      </label>
      {err && <p className="form-error">{err}</p>}
    </Sheet>
  )
}
