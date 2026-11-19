import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { STAGE_BY_KEY } from '../lib/constants.js'
import { fmtDate, telHref, smsHref, directionsHref } from '../lib/format.js'
import { dueLabel, isDue, isOverdue } from '../lib/dates.js'
import { PageHeader, Badge, Empty, FollowUpPicker } from './ui.jsx'
import { Icon } from './Icon.jsx'
import Notes from './Notes.jsx'
import Photos from './Photos.jsx'
import Estimates from './Estimates.jsx'

const TABS = [
  { key: 'info', label: 'Info' },
  { key: 'notes', label: 'Notes' },
  { key: 'photos', label: 'Photos' },
  { key: 'estimates', label: 'Estimates' },
]

export default function ContactDetail() {
  const { id } = useParams()
  const { contacts, doors, upsertContact, removeContact, showToast, nameOf } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState(() => sessionStorageGet('tab-' + id) || 'info')
  const [busy, setBusy] = useState(false)
  const [editFollow, setEditFollow] = useState(false)
  const c = contacts.find((x) => x.id === id)

  if (!c) {
    return (
      <div className="page">
        <PageHeader title="Not found" back="/leads" />
        <Empty title="This lead or client doesn't exist anymore." />
      </div>
    )
  }

  const stage = STAGE_BY_KEY[c.stage]
  const door = doors.find((d) => d.id === c.door_id)

  function pickTab(k) {
    setTab(k)
    sessionStorageSet('tab-' + id, k)
  }

  async function setStage(next) {
    setBusy(true)
    const patch = { stage: next }
    if (next === 'client') patch.converted_at = new Date().toISOString()
    if (next === 'lead') patch.converted_at = null
    const { data, error } = await supabase.from('contacts').update(patch).eq('id', c.id).select().single()
    setBusy(false)
    if (error) return showToast(error.message)
    upsertContact(data)
    showToast(next === 'client' ? 'Converted to client 🎉' : next === 'lost' ? 'Marked as lost' : 'Moved back to leads')
  }

  async function saveFollowUp(value) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ follow_up_at: value })
      .eq('id', c.id)
      .select()
      .single()
    if (error) return showToast(error.message)
    upsertContact(data)
    setEditFollow(false)
    showToast(value ? 'Follow-up set for ' + dueLabel(value) : 'Follow-up marked done')
  }

  async function del() {
    if (!window.confirm(`Delete ${c.name}? This also deletes their notes, photos and estimates.`)) return
    const { data: ph } = await supabase.from('photos').select('path').eq('contact_id', c.id)
    if (ph?.length) await supabase.storage.from('job-photos').remove(ph.map((p) => p.path))
    const { error } = await supabase.from('contacts').delete().eq('id', c.id)
    if (error) return showToast(error.message)
    removeContact(c.id)
    showToast('Deleted')
    nav(c.stage === 'client' ? '/clients' : '/leads', { replace: true })
  }

  return (
    <div className="page">
      <PageHeader
        title={c.name}
        back={c.stage === 'client' ? '/clients' : '/leads'}
        sub={<Badge color={stage.color}>{stage.label}</Badge>}
        right={
          <button className="icon-btn" onClick={() => nav(`/contacts/${c.id}/edit`)} aria-label="Edit">
            <Icon name="edit" />
          </button>
        }
      />

      <div className="quick-actions">
        {c.phone ? (
          <>
            <a className="qa" href={telHref(c.phone)}>
              <Icon name="phone" /> Call
            </a>
            <a className="qa" href={smsHref(c.phone)}>
              <Icon name="message" /> Text
            </a>
          </>
        ) : (
          <button className="qa" onClick={() => nav(`/contacts/${c.id}/edit`)}>
            <Icon name="phone" /> Add phone
          </button>
        )}
        {(c.address || c.lat != null) && (
          <a className="qa" href={directionsHref(c)} target="_blank" rel="noreferrer">
            <Icon name="nav" /> Directions
          </a>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={'tab-btn' + (tab === t.key ? ' on' : '')} onClick={() => pickTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {tab === 'info' && (
          <>
            {c.stage !== 'lost' && (
              <div
                className={
                  'followup-card mb' +
                  (isOverdue(c.follow_up_at) ? ' overdue' : isDue(c.follow_up_at) ? ' due' : '')
                }
              >
                <div className="row between gap-sm">
                  <div>
                    <div className="label">Next follow-up</div>
                    <b>{c.follow_up_at ? dueLabel(c.follow_up_at) : 'None set'}</b>
                  </div>
                  <div className="row gap-sm">
                    {c.follow_up_at && !editFollow && (
                      <button className="btn sm" onClick={() => saveFollowUp(null)}>
                        <Icon name="check" size={14} /> Done
                      </button>
                    )}
                    <button className="btn sm" onClick={() => setEditFollow((v) => !v)}>
                      {editFollow ? 'Cancel' : c.follow_up_at ? 'Change' : 'Set'}
                    </button>
                  </div>
                </div>
                {editFollow && (
                  <div className="mt-sm">
                    <FollowUpPicker value={c.follow_up_at} onChange={saveFollowUp} />
                  </div>
                )}
              </div>
            )}
            <div className="card info-card">
              <InfoRow label="Phone" value={c.phone} />
              <InfoRow label="Email" value={c.email} />
              <InfoRow label="Address" value={c.address} />
              <InfoRow label="Interested in" value={c.services?.join(', ')} />
              <InfoRow label="Budget" value={c.budget} />
              <InfoRow label="Best time" value={c.best_time} />
              <InfoRow label="Source" value={c.source} />
              <InfoRow label="Added" value={`${fmtDate(c.created_at)} by ${nameOf(c.created_by)}`} />
              {c.converted_at && <InfoRow label="Client since" value={fmtDate(c.converted_at)} />}
              {door && <InfoRow label="Door status" value="Pinned on the map" />}
              {c.notes && (
                <div className="info-notes">
                  <div className="label">Notes</div>
                  <div className="pre">{c.notes}</div>
                </div>
              )}
            </div>

            <div className="stack mt">
              {c.stage === 'lead' && (
                <>
                  <button className="btn primary block" disabled={busy} onClick={() => setStage('client')}>
                    <Icon name="check" size={18} /> Convert to client
                  </button>
                  <button className="btn block" disabled={busy} onClick={() => setStage('lost')}>
                    Mark as lost
                  </button>
                </>
              )}
              {c.stage === 'client' && (
                <button className="btn block" disabled={busy} onClick={() => setStage('lead')}>
                  Move back to leads
                </button>
              )}
              {c.stage === 'lost' && (
                <button className="btn primary block" disabled={busy} onClick={() => setStage('lead')}>
                  Reopen as lead
                </button>
              )}
              <button className="btn danger-link" onClick={del}>
                <Icon name="trash" size={16} /> Delete {c.stage === 'client' ? 'client' : 'lead'}
              </button>
            </div>
          </>
        )}
        {tab === 'notes' && <Notes contactId={c.id} />}
        {tab === 'photos' && <Photos contactId={c.id} />}
        {tab === 'estimates' && <Estimates contact={c} />}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="info-row">
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  )
}

function sessionStorageGet(k) {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}
function sessionStorageSet(k, v) {
  try {
    sessionStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}
