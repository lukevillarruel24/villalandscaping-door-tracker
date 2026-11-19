import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { EST_STATUS_BY_KEY } from '../lib/constants.js'
import { estimateTotals, fmtDate, fmtMoney } from '../lib/format.js'
import { Badge, Empty } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function Estimates({ contact }) {
  const { userId, showToast } = useStore()
  const nav = useNavigate()
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    supabase
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => alive && setList(data || []))
    return () => {
      alive = false
    }
  }, [contact.id])

  async function create() {
    setBusy(true)
    const svc = contact.services?.length ? contact.services.join(' + ') : 'Landscape project'
    const { data, error } = await supabase
      .from('estimates')
      .insert({ contact_id: contact.id, title: svc, created_by: userId })
      .select()
      .single()
    setBusy(false)
    if (error) return showToast(error.message)
    nav(`/estimates/${data.id}`)
  }

  return (
    <div>
      <button className="btn primary block" onClick={create} disabled={busy}>
        <Icon name="plus" size={18} /> New estimate
      </button>
      {list === null && <div className="muted small mt">Loading…</div>}
      {list?.length === 0 && <Empty title="No estimates yet" />}
      <div className="list mt">
        {list?.map((e) => {
          const { total } = estimateTotals(e.estimate_items || [], e.tax_rate)
          const st = EST_STATUS_BY_KEY[e.status]
          return (
            <button key={e.id} className="list-item as-btn" onClick={() => nav(`/estimates/${e.id}`)}>
              <div className="list-main">
                <div className="row gap-sm">
                  <b>{e.title}</b>
                  <Badge color={st.color}>{st.label}</Badge>
                </div>
                <div className="small muted">
                  #{e.number} · {fmtDate(e.created_at)} · {(e.estimate_items || []).length} items
                </div>
              </div>
              <div className="amount">{fmtMoney(total)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
