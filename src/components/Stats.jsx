import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchAll, useStore } from '../lib/store.jsx'
import { STATUSES, STATUS_BY_KEY } from '../lib/constants.js'
import { estimateTotals, fmtMoney } from '../lib/format.js'
import {
  addDays,
  dayKey,
  fmtDay,
  fmtShortDay,
  fmtTime,
  fromDayKey,
  startOfDay,
  startOfWeek,
} from '../lib/dates.js'
import { PageHeader } from './ui.jsx'
import { Icon } from './Icon.jsx'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'lastweek', label: 'Last week' },
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Pick dates…' },
]

function rangeFor(preset, customFrom, customTo) {
  const now = new Date()
  const today = startOfDay(now)
  switch (preset) {
    case 'today':
      return { from: today, to: null }
    case 'yesterday':
      return { from: addDays(today, -1), to: today }
    case 'week':
      return { from: startOfWeek(now), to: null }
    case 'lastweek':
      return { from: addDays(startOfWeek(now), -7), to: startOfWeek(now) }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null }
    case '30d':
      return { from: addDays(today, -29), to: null }
    case 'custom': {
      const f = customFrom ? fromDayKey(customFrom) : today
      const t = customTo ? addDays(fromDayKey(customTo), 1) : addDays(f, 1)
      return t > f ? { from: f, to: t } : { from: f, to: addDays(f, 1) }
    }
    default:
      return { from: null, to: null }
  }
}

export default function Stats() {
  const { contacts, profiles, nameOf, userId } = useStore()
  const [preset, setPreset] = useState('week')
  const [customFrom, setCustomFrom] = useState(dayKey(new Date()))
  const [customTo, setCustomTo] = useState(dayKey(new Date()))
  const [who, setWho] = useState('all')
  const [visits, setVisits] = useState(null)
  const [estimates, setEstimates] = useState(null)
  const [doorAddr, setDoorAddr] = useState({})

  const { from, to } = rangeFor(preset, customFrom, customTo)
  const fromIso = from?.toISOString() || ''
  const toIso = to?.toISOString() || ''

  useEffect(() => {
    let alive = true
    setVisits(null)
    fetchAll('visits', 'created_at', (q) => {
      if (fromIso) q = q.gte('created_at', fromIso)
      if (toIso) q = q.lt('created_at', toIso)
      return q
    }).then(({ data }) => alive && setVisits(data || []))
    return () => {
      alive = false
    }
  }, [fromIso, toIso])

  useEffect(() => {
    supabase
      .from('estimates')
      .select('id, contact_id, status, tax_rate, updated_at, estimate_items(qty, unit_price)')
      .then(({ data }) => setEstimates(data || []))
    supabase
      .from('doors')
      .select('id, address')
      .then(({ data }) => setDoorAddr(Object.fromEntries((data || []).map((d) => [d.id, d.address]))))
  }, [])

  const inRange = (d) => {
    if (!d) return false
    const t = new Date(d)
    return (!from || t >= from) && (!to || t < to)
  }
  const byWho = (id) => who === 'all' || id === who
  const personName = (id) => (id && profiles[id] ? (id === userId ? 'You' : nameOf(id)) : 'Unknown')

  const data = useMemo(() => {
    if (!visits) return null
    const vs = visits.filter((v) => byWho(v.created_by))
    const contactById = Object.fromEntries(contacts.map((c) => [c.id, c]))
    const newLeads = contacts.filter((c) => inRange(c.created_at) && byWho(c.created_by))
    const newClients = contacts.filter((c) => c.stage === 'client' && inRange(c.converted_at) && byWho(c.created_by))

    // Per day, per person
    const rows = {}
    const row = (day, pid) =>
      (rows[day + '|' + pid] ||= { day, pid, doors: new Set(), knocks: 0, leads: 0, first: null, last: null })
    for (const v of vs) {
      const r = row(dayKey(v.created_at), v.created_by || 'none')
      r.doors.add(v.door_id)
      r.knocks++
      const t = new Date(v.created_at)
      if (!r.first || t < r.first) r.first = t
      if (!r.last || t > r.last) r.last = t
    }
    for (const c of newLeads) row(dayKey(c.created_at), c.created_by || 'none').leads++
    const daily = Object.values(rows)
      .map((r) => {
        const hours = r.first && r.last ? (r.last - r.first) / 36e5 : 0
        return { ...r, doors: r.doors.size, hours, perHour: hours >= 0.25 ? r.doors.size / hours : null }
      })
      .sort((a, b) => (a.day === b.day ? b.doors - a.doors : a.day < b.day ? 1 : -1))

    // Per person totals
    const people = {}
    for (const r of daily) {
      const p = (people[r.pid] ||= { pid: r.pid, doors: 0, leads: 0, clients: 0, hours: 0, days: 0 })
      p.doors += r.doors
      p.leads += r.leads
      p.hours += r.hours
      if (r.knocks) p.days++
    }
    for (const c of newClients) (people[c.created_by || 'none'] ||= { pid: c.created_by || 'none', doors: 0, leads: 0, clients: 0, hours: 0, days: 0 }).clients++
    const personRows = Object.values(people).sort((a, b) => b.doors - a.doors || b.leads - a.leads)

    const byStatus = {}
    for (const v of vs) byStatus[v.status] = (byStatus[v.status] || 0) + 1

    const sources = {}
    for (const c of newLeads) {
      const k = c.source || 'Not set'
      sources[k] = (sources[k] || 0) + 1
    }

    let won = 0
    let wonCount = 0
    let pipeline = 0
    for (const e of estimates || []) {
      const c = contactById[e.contact_id]
      if (!c || !byWho(c.created_by)) continue
      const { total } = estimateTotals(e.estimate_items || [], e.tax_rate)
      if (e.status === 'accepted' && inRange(e.updated_at)) {
        won += total
        wonCount++
      }
      if (e.status === 'sent') pipeline += total
    }

    const doorsTotal = daily.reduce((s, r) => s + r.doors, 0)
    const hoursTotal = daily.reduce((s, r) => s + r.hours, 0)

    // Chart: one bar per hour for a single day, otherwise one bar per day
    const singleDay = from && to ? to - from <= 864e5 + 3600e3 : from && !to && dayKey(from) === dayKey(new Date())
    let bars = []
    if (singleDay) {
      const byHour = {}
      for (const v of vs) {
        const h = new Date(v.created_at).getHours()
        byHour[h] = (byHour[h] || 0) + 1
      }
      const hrs = Object.keys(byHour).map(Number)
      const lo = Math.min(8, ...hrs)
      const hi = Math.max(18, ...hrs)
      for (let h = lo; h <= hi; h++) {
        const label = new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })
        bars.push({ key: 'h' + h, short: label.replace(' ', '').toLowerCase(), long: label, value: byHour[h] || 0, unit: 'knocks' })
      }
    } else {
      const doorsByDay = {}
      const leadsByDay = {}
      for (const r of daily) {
        doorsByDay[r.day] = (doorsByDay[r.day] || 0) + r.doors
        leadsByDay[r.day] = (leadsByDay[r.day] || 0) + r.leads
      }
      const days = Object.keys(doorsByDay).sort()
      const start = from || (days[0] ? fromDayKey(days[0]) : startOfDay())
      const end = to ? addDays(to, -1) : startOfDay()
      let d = start
      const all = []
      while (d <= end && all.length < 400) {
        const k = dayKey(d)
        all.push({ key: k, short: fmtShortDay(d), long: fmtDay(d), value: doorsByDay[k] || 0, leads: leadsByDay[k] || 0, unit: 'doors' })
        d = addDays(d, 1)
      }
      bars = all.slice(-62)
    }

    return {
      daily,
      personRows,
      byStatus,
      sources,
      leads: newLeads.length,
      clients: newClients.length,
      won,
      wonCount,
      pipeline,
      doorsTotal,
      hoursTotal,
      knocks: vs.length,
      bars,
      singleDay,
      vs,
    }
  }, [visits, estimates, contacts, fromIso, toIso, who, profiles])

  function openDay(day) {
    setPreset('custom')
    setCustomFrom(day)
    setCustomTo(day)
    window.scrollTo?.(0, 0)
  }

  function exportKnocks() {
    const rows = [['Date', 'Time', 'Person', 'Address', 'Result', 'Note']]
    for (const v of [...data.vs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
      rows.push([
        dayKey(v.created_at),
        fmtTime(v.created_at),
        personName(v.created_by),
        doorAddr[v.door_id] || '',
        STATUS_BY_KEY[v.status]?.label || v.status,
        v.note || '',
      ])
    }
    downloadCsv(`villa-knocks-${rangeName()}.csv`, rows)
  }

  function exportContacts() {
    const rows = [
      ['Name', 'Stage', 'Phone', 'Email', 'Address', 'Interested in', 'Budget', 'Source', 'Next follow-up', 'Added', 'Added by', 'Notes'],
    ]
    for (const c of contacts) {
      rows.push([
        c.name,
        c.stage,
        c.phone || '',
        c.email || '',
        c.address || '',
        (c.services || []).join('; '),
        c.budget || '',
        c.source || '',
        c.follow_up_at ? new Date(c.follow_up_at).toLocaleString('en-US') : '',
        dayKey(c.created_at),
        personName(c.created_by),
        c.notes || '',
      ])
    }
    downloadCsv(`villa-leads-and-clients-${dayKey(new Date())}.csv`, rows)
  }

  const rangeName = () =>
    from ? `${dayKey(from)}_to_${dayKey(to ? addDays(to, -1) : new Date())}` : 'all-time'

  const rangeText = from
    ? dayKey(from) === dayKey(to ? addDays(to, -1) : new Date())
      ? fmtDay(from)
      : `${fmtDay(from)} – ${fmtDay(to ? addDays(to, -1) : new Date())}`
    : 'All time'

  return (
    <div className="page">
      <PageHeader title="Stats" sub={rangeText} />
      <div className="page-body">
        <div className="stats-controls">
          <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Date range">
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
            <option value="all">Everyone</option>
            {Object.values(profiles).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === userId ? `Me (${p.full_name || 'you'})` : p.full_name || p.email}
              </option>
            ))}
          </select>
        </div>
        {preset === 'custom' && (
          <div className="row gap-sm mt-sm">
            <label className="field grow">
              <span>From</span>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="field grow">
              <span>To</span>
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
        )}

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
              <Tile label="Time out" value={fmtHours(data.hoursTotal)} sub={data.hoursTotal >= 0.25 ? `${(data.doorsTotal / data.hoursTotal).toFixed(1)} doors / hr` : 'first to last knock'} />
              <Tile label="New clients" value={data.clients} sub={data.leads ? `${pct(data.clients, data.leads)} of leads` : ''} />
              <Tile label="Won (accepted)" value={fmtMoney(data.won)} sub={`${data.wonCount} estimates`} />
              <Tile label="Out for signature" value={fmtMoney(data.pipeline)} sub="sent estimates" />
            </div>

            <div className="section-title mt">{data.singleDay ? 'Knocks by hour' : 'Doors per day'}</div>
            <BarChart bars={data.bars} onPick={data.singleDay ? null : openDay} />

            <div className="section-title mt">Daily log</div>
            <div className="card table-card">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="num">Doors</th>
                    <th className="num">Leads</th>
                    <th>Time out</th>
                    <th className="num">/hr</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Nothing logged for this period.
                      </td>
                    </tr>
                  )}
                  {data.daily.map((r) => (
                    <tr key={r.day + r.pid} className="clickable" onClick={() => openDay(r.day)}>
                      <td>
                        <b>{fmtDay(fromDayKey(r.day))}</b>
                        <div className="tiny muted">{personName(r.pid)}</div>
                      </td>
                      <td className="num">{r.doors}</td>
                      <td className="num">{r.leads}</td>
                      <td>
                        {r.first ? (
                          <>
                            {fmtTime(r.first)}–{fmtTime(r.last)}
                            <div className="tiny muted">{fmtHours(r.hours)}</div>
                          </>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                      <td className="num">{r.perHour ? r.perHour.toFixed(1) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted mt-sm">Time out = first knock to last knock that day. Tap a day to see just that day.</p>

            {who === 'all' && (
              <>
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
                        <th className="num">Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.personRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="muted">
                            Nothing logged for this period.
                          </td>
                        </tr>
                      )}
                      {data.personRows.map((r) => (
                        <tr key={r.pid} className="clickable" onClick={() => setWho(r.pid)}>
                          <td>{personName(r.pid)}</td>
                          <td className="num">{r.doors}</td>
                          <td className="num">{r.leads}</td>
                          <td className="num">{r.clients}</td>
                          <td className="num">{r.doors ? pct(r.leads, r.doors) : '–'}</td>
                          <td className="num">{r.hours ? r.hours.toFixed(1) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

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

            <div className="section-title mt">Where new leads came from</div>
            <div className="card pad">
              {Object.keys(data.sources).length === 0 && <div className="muted small">No new leads in this period.</div>}
              {Object.entries(data.sources)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <div key={k} className="bar-row">
                    <div className="bar-label">{k}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: (n / data.leads) * 100 + '%', background: 'var(--green-2)' }} />
                    </div>
                    <div className="bar-num">{n}</div>
                  </div>
                ))}
            </div>

            <div className="section-title mt">Download for a spreadsheet</div>
            <div className="stack-sm">
              <button className="btn block" onClick={exportKnocks} disabled={!data.vs.length}>
                <Icon name="history" size={16} /> Knocks for this period (CSV)
              </button>
              <button className="btn block" onClick={exportContacts} disabled={!contacts.length}>
                <Icon name="star" size={16} /> All leads and clients (CSV)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BarChart({ bars, onPick }) {
  const [active, setActive] = useState(null)
  const max = Math.max(1, ...bars.map((b) => b.value))
  const step = Math.ceil(bars.length / 8)
  const cur = active != null ? bars[active] : null
  const total = bars.reduce((s, b) => s + b.value, 0)
  return (
    <div className="card chart-card">
      <div className="chart-readout small">
        {cur ? (
          <>
            <b>{cur.long}</b>: {cur.value} {cur.unit}
            {cur.leads ? `, ${cur.leads} ${cur.leads === 1 ? 'lead' : 'leads'}` : ''}
            {onPick && (
              <button className="btn link inline view-day" onClick={() => onPick(cur.key)}>
                View day →
              </button>
            )}
          </>
        ) : total ? (
          <span className="muted">Tap a bar for details · busiest: {Math.max(...bars.map((b) => b.value))}</span>
        ) : (
          <span className="muted">Nothing logged yet</span>
        )}
      </div>
      <div className="chart" role="img" aria-label="Bar chart">
        <div className="chart-gridline" style={{ bottom: '100%' }}>
          <span>{max}</span>
        </div>
        <div className="chart-gridline" style={{ bottom: '50%' }}>
          <span>{Math.round(max / 2)}</span>
        </div>
        <div className="chart-bars">
          {bars.map((b, i) => (
            <button
              key={b.key}
              className={'chart-col' + (active === i ? ' on' : '')}
              onMouseEnter={(e) => e.nativeEvent?.pointerType !== 'touch' && setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${b.long}: ${b.value} ${b.unit}`}
            >
              <span className="chart-bar" style={{ height: (b.value / max) * 100 + '%' }} />
            </button>
          ))}
        </div>
      </div>
      <div className="chart-axis">
        {bars.map((b, i) => (
          <span key={b.key}>{i % step === 0 ? b.short : ''}</span>
        ))}
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

function fmtHours(h) {
  if (!h || h < 1 / 60) return '0m'
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return hh ? `${hh}h ${mm}m` : `${mm}m`
}

function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
