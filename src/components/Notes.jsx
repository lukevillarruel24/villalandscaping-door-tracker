import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { fmtDateTime } from '../lib/format.js'
import { Empty } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function Notes({ contactId }) {
  const { nameOf, userId, showToast } = useStore()
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .then(({ data }) => alive && setNotes(data || []))
    return () => {
      alive = false
    }
  }, [contactId])

  async function add(e) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    const { data, error } = await supabase
      .from('contact_notes')
      .insert({ contact_id: contactId, body: body.trim(), created_by: userId })
      .select()
      .single()
    setBusy(false)
    if (error) return showToast(error.message)
    setNotes((n) => [data, ...(n || [])])
    setBody('')
  }

  async function del(id) {
    if (!window.confirm('Delete this note?')) return
    const { error } = await supabase.from('contact_notes').delete().eq('id', id)
    if (error) return showToast(error.message)
    setNotes((n) => n.filter((x) => x.id !== id))
  }

  return (
    <div>
      <form className="note-form" onSubmit={add}>
        <textarea
          rows={3}
          placeholder="Called back, wants pavers + lighting, sending estimate Friday…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn primary" disabled={busy || !body.trim()}>
          Add note
        </button>
      </form>
      {notes === null && <div className="muted small">Loading…</div>}
      {notes?.length === 0 && <Empty title="No notes yet" />}
      <div className="timeline">
        {notes?.map((n) => (
          <div key={n.id} className="note">
            <div className="row between">
              <span className="small muted">
                {fmtDateTime(n.created_at)} · {nameOf(n.created_by)}
              </span>
              <button className="icon-btn sm" onClick={() => del(n.id)} aria-label="Delete note">
                <Icon name="trash" size={14} />
              </button>
            </div>
            <div className="pre">{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
