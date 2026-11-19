import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchAll, useStore } from '../lib/store.jsx'
import { STATUSES } from '../lib/constants.js'
import { estimateTotals, fmtMoney } from '../lib/format.js'
import { PageHeader } from './ui.jsx'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

function startOf(key) {
  const n = new Date()
  if (key === 'today') return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  if (key === 'week') {
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate())
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday
    return d
  }
  if (key === 'month') return new Date(n.getFullYear(), n.getMonth(), 1)
  return null
}

export default function Stats() {
  const { contacts, profiles, nameOf } = useStore()
  const [range, setRange] = useState('week')
  const [visits, setVisits] = useState(null)
  const [estimates, setEstimates] = useState(null)

  const since = startOf(range)

  useEffect(() => {
    let alive = true
    setVisits(null)
    fetchAll('visits', 'created_at', (q) => (since ? q.gte('created_at', since.toISOString()) : q)).then(
      ({ data }) => alive && setVisits(data || []),
    )
    supabase
      .from('estimates')
      .select('id, status, tax_rate, created_by, updated_at, estimate_items(qty, unit_price)')
      .then(({ data }) => alive && setEstimates(data || []))
    return () => {
      alive = false
    }
  }, [range])

  const inRange = (d) => !since || (d && new Date(d) >= since)

  const data = useMemo(() => {
    if (!visits) return null
    const people = {}
    const row = (id) =>
      (people[id || 'none'] ||= { id, knocks: 0, doors: new Set(), leads: 0, clients: 0 })
    const byStatus = {}
    for (const v of visits) {
      const r = row(v.created_by)
      r.knocks++
      r.doors.add(v.door_id)
      byStatus[v.status] = (byStatus[v.status] || 0) + 1
    }
    let leads = 0
    let clients = 0
    for (const c of contacts) {
      if (inRange(c.created_at)) {
        row(c.created_by).leads++
        leads++
      }
      if (c.stage === 'client' && inRange(c.converted_at)) {
        row(c.created_by).clients++
        clients++
      }
    }
    let won = 0
    let wonCount = 0
    let pipeline = 0
    for (const e of estimates || []) {
      const { total } = estimateTotals(e.estimate_items || [], e.tax_rate)
      if (e.status === 'accepted' && inRange(e.updated_at)) {
        won += total
        wonCount++
      }
      if (e.status === 'sent') pipeline += total
    }
    const doorsTotal = new Set(visits.map((v) => v.door_id)).size
    const rows = Object.values(people)
      .map((p) => ({ ...p, doors: p.doors.size }))
      .sort((a, b) => b.knocks - a.knocks || b.leads - a.leads)
    return { rows, byStatus, leads, clients, won, wonCount, pipeline, doorsTotal, knocks: visits.length }
  }, [visits, estimates, contacts, range])

  return (
    <div className="page">
      <PageHeader title="Stats" />
      <div className="page-body">
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.key} className={'seg-btn' + (range === r.key ? ' on' : '')} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="splash inline">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="tiles">
              <Tile label="Doors knocked" value={data.doorsTotal} sub={`${data.knocks} knocks`} />
              <Tile
                label="New leads"
                value={data.leads}
                sub={data.doorsTotal ? `${pct(data.leads, data.doorsTotal)} of doors` : ''}
              />
              <Tile
                label="New clients"
                value={data.clients}
                sub={data.leads ? `${pct(data.clients, data.leads)} of leads` : ''}
              />
              <Tile label="Won (accepted)" value={fmtMoney(data.won)} sub={`${data.wonCount} estimates`} />
            </div>
            {data.pipeline > 0 && (
              <div className="card pad small">
                Out for signature right now: <b>{fmtMoney(data.pipeline)}</b> in sent estimates
              </div>
            )}

            <div className="section-title mt">By person</div>
            <div className="card table-card">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="num">Doors</th>
                    <th className="num">Leads</th>
                    <th className="num">Clients</th>
                    <th className="num">Lead %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Nothing logged yet for this period.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => (
                    <tr key={r.id || 'none'}>
                      <td>{r.id && profiles[r.id] ? nameOf(r.id) : 'Unknown'}</td>
                      <td className="num">{r.doors}</td>
                      <td className="num">{r.leads}</td>
                      <td className="num">{r.clients}</td>
                      <td className="num">{r.doors ? pct(r.leads, r.doors) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section-title mt">What happened at the door</div>
            <div className="card pad">
              {STATUSES.map((s) => {
                const n = data.byStatus[s.key] || 0
                const w = data.knocks ? (n / data.knocks) * 100 : 0
                return (
                  <div key={s.key} className="bar-row">
                    <div className="bar-label">{s.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: w + '%', background: s.color }} />
                    </div>
                    <div className="bar-num">{n}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="tile card">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  )
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '0%')
