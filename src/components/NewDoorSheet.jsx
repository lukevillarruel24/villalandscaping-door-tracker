import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { reverseGeocode, distanceM } from '../lib/geo.js'
import { enqueue, isNetworkError } from '../lib/offline.js'
import { followUpChoices } from '../lib/dates.js'
import { Sheet, StatusPicker, FollowUpPicker } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function NewDoorSheet({ pin, onClose, onOpenExisting, onSavedNext }) {
  const { doors, upsertDoor, showToast, userId, markKnockedToday } = useStore()
  const nav = useNavigate()
  const [address, setAddress] = useState('')
  const [looking, setLooking] = useState(true)
  const [options, setOptions] = useState([])
  const [noNumber, setNoNumber] = useState(false)
  const [status, setStatus] = useState(null)
  const [followUp, setFollowUp] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const addrRef = useRef()

  useEffect(() => {
    let alive = true
    if (pin.prefill) {
      setAddress(pin.prefill.address || '')
      setOptions(pin.prefill.options || [])
      setNoNumber(!!pin.prefill.address && !pin.prefill.hasNumber)
      setLooking(false)
      return
    }
    reverseGeocode(pin.lat, pin.lng).then((r) => {
      if (!alive) return
      setAddress((cur) => cur || r.address)
      setOptions(r.options || [])
      setNoNumber(!!r.address && !r.hasNumber)
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

  function pickStatus(s) {
    setStatus(s)
    setErr('')
    // Come Back Later defaults to "later today" so it's never forgotten
    if (s === 'come_back' && !followUp) setFollowUp(followUpChoices()[0].date.toISOString())
    if (s !== 'come_back') setFollowUp(null)
  }

  async function save(next) {
    if (!status) {
      setErr('Pick what happened at the door.')
      return
    }
    setBusy(true)
    setErr('')
    const now = new Date().toISOString()
    const door = {
      id: crypto.randomUUID(),
      lat: pin.lat,
      lng: pin.lng,
      address: address.trim() || null,
      status,
      notes: note.trim() || null,
      follow_up_at: status === 'come_back' ? followUp : null,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    }
    const visit = {
      id: crypto.randomUUID(),
      door_id: door.id,
      status,
      note: note.trim() || null,
      created_by: userId,
      created_at: now,
    }

    const { data, error } = await supabase.from('doors').insert(door).select().single()
    if (error) {
      setBusy(false)
      if (isNetworkError(error)) {
        enqueue({ type: 'door', door, visit })
        markKnockedToday(door.id)
        showToast(
          status === 'lead'
            ? 'No signal. Pin saved on your phone. Add the lead info once you have signal.'
            : 'No signal. Saved on your phone, will upload automatically.',
        )
        onClose()
        if (next) onSavedNext?.()
        return
      }
      setErr(error.message)
      return
    }
    const v = await supabase.from('visits').insert(visit)
    if (v.error && isNetworkError(v.error)) enqueue({ type: 'knock', visit, patch: { status } })
    upsertDoor(data)
    markKnockedToday(data.id)
    setBusy(false)
    onClose()
    if (status === 'lead') {
      showToast('Pin saved. Add the lead details.')
      nav(`/contacts/new?door=${data.id}`)
    } else if (next) {
      showToast('Saved. Drop the next one.')
      onSavedNext?.()
    } else {
      showToast('Pin saved')
    }
  }

  const isLead = status === 'lead'

  return (
    <Sheet
      title="New door"
      onClose={onClose}
      footer={
        isLead ? (
          <button className="btn primary block" onClick={() => save(false)} disabled={busy}>
            {busy ? 'Saving…' : 'Save and add lead info'}
          </button>
        ) : (
          <div className="row gap-sm">
            <button className="btn" onClick={() => save(false)} disabled={busy}>
              Save
            </button>
            <button className="btn primary grow" onClick={() => save(true)} disabled={busy}>
              {busy ? 'Saving…' : (
                <>
                  Save + next door <Icon name="plus" size={16} stroke={2.6} />
                </>
              )}
            </button>
          </div>
        )
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
        <input
          ref={addrRef}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setNoNumber(false)
          }}
          placeholder="123 Main St, Calhoun, GA"
        />
      </label>
      {noNumber && (
        <div className="notice small">
          No house number found for this spot. Add it from the mailbox.{' '}
          <button
            type="button"
            className="btn link inline"
            onClick={() => {
              const el = addrRef.current
              el.focus()
              el.setSelectionRange(0, 0)
            }}
          >
            Add number
          </button>
        </div>
      )}
      {options.length > 1 && (
        <div className="field">
          <span>Not the right house? Tap the correct one:</span>
          <div className="chip-row">
            {options.map((o) => (
              <button
                key={o.address}
                type="button"
                className={'chip toggle' + (o.address === address ? ' on' : '')}
                onClick={() => {
                  setAddress(o.address)
                  setNoNumber(!o.hasNumber)
                }}
              >
                {o.address.split(',')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <span>What happened?</span>
        <StatusPicker value={status} onChange={pickStatus} />
      </div>
      {status === 'come_back' && (
        <div className="field">
          <span>When should we come back?</span>
          <FollowUpPicker value={followUp} onChange={setFollowUp} allowClear={false} />
        </div>
      )}
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
