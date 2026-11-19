import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { timeAgo, telHref } from '../lib/format.js'
import { dueLabel, isDue, isOverdue } from '../lib/dates.js'
import { PageHeader, Empty, Badge } from './ui.jsx'
import { Icon } from './Icon.jsx'
import { STAGE_BY_KEY } from '../lib/constants.js'

export default function ContactList({ stage }) {
  const { contacts, nameOf, due } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [showLost, setShowLost] = useState(false)
  const [sort, setSort] = useState('newest')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const rows = contacts
      .filter((c) => c.stage === stage || (stage === 'lead' && showLost && c.stage === 'lost'))
      .filter(
        (c) =>
          !term ||
          [c.name, c.address, c.phone, c.email, c.source, ...(c.services || [])]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(term)),
      )
    const t = (d) => (d ? new Date(d).getTime() : 0)
    if (sort === 'followup') {
      return rows.sort((a, b) => (t(a.follow_up_at) || Infinity) - (t(b.follow_up_at) || Infinity))
    }
    if (sort === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows.sort((a, b) =>
      stage === 'client'
        ? t(b.converted_at || b.created_at) - t(a.converted_at || a.created_at)
        : t(b.created_at) - t(a.created_at),
    )
  }, [contacts, stage, q, showLost, sort])

  const lostCount = contacts.filter((c) => c.stage === 'lost').length
  const title = stage === 'client' ? 'Clients' : 'Leads'
  const dueLeads = stage === 'lead' ? due.leads : contacts.filter((c) => c.stage === 'client' && isDue(c.follow_up_at))

  return (
    <div className="page">
      <PageHeader
        title={title}
        sub={`${list.length} ${list.length === 1 ? title.slice(0, -1).toLowerCase() : title.toLowerCase()}`}
        right={
          <>
            <button
              className="btn sm"
              onClick={() => nav(stage === 'client' ? '/estimates/new?stage=client' : '/estimates/new')}
            >
              <Icon name="plus" size={16} /> Estimate
            </button>
            {stage === 'lead' && (
              <button className="btn primary sm" onClick={() => nav('/contacts/new')}>
                <Icon name="plus" size={16} /> Lead
              </button>
            )}
          </>
        }
      />
      <div className="page-body">
        {(dueLeads.length > 0 || (stage === 'lead' && due.revisits.length > 0)) && (
          <div className="card due-card">
            <div className="due-head">
              <Icon name="history" size={18} />
              <b>Follow-ups due</b>
            </div>
            {dueLeads
              .slice()
              .sort((a, b) => new Date(a.follow_up_at) - new Date(b.follow_up_at))
              .map((c) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="due-row">
                  <span className="grow">
                    <b>{c.name}</b>
                    {c.address && <span className="small muted"> · {c.address.split(',')[0]}</span>}
                  </span>
                  <span className={'due-when' + (isOverdue(c.follow_up_at) ? ' overdue' : '')}>
                    {dueLabel(c.follow_up_at)}
                  </span>
                </Link>
              ))}
            {stage === 'lead' && due.revisits.length > 0 && (
              <button className="due-row as-btn" onClick={() => nav('/?revisits=1')}>
                <span className="grow">
                  <b>
                    {due.revisits.length} {due.revisits.length === 1 ? 'door' : 'doors'} to knock again
                  </b>
                  <span className="small muted"> · "Come Back Later" pins</span>
                </span>
                <span className="due-when">Show on map →</span>
              </button>
            )}
          </div>
        )}

        <div className="search-bar flat">
          <Icon name="search" size={18} />
          <input placeholder="Search name, address, phone, service" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row between gap-sm list-tools">
          {stage === 'lead' && lostCount > 0 ? (
            <label className="check-row">
              <input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} />
              Show lost ({lostCount})
            </label>
          ) : (
            <span />
          )}
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="followup">Follow-up date</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {list.length === 0 ? (
          <Empty title={q ? 'No matches' : stage === 'client' ? 'No clients yet' : 'No leads yet'}>
            {!q &&
              (stage === 'client'
                ? 'Open a lead and tap "Convert to client" when they sign.'
                : 'Mark a door as "Lead" on the map, or tap New.')}
          </Empty>
        ) : (
          <div className="list">
            {list.map((c) => (
              <div key={c.id} className="list-item">
                <Link to={`/contacts/${c.id}`} className="list-main">
                  <div className="row gap-sm wrap">
                    <b>{c.name}</b>
                    {c.stage === 'lost' && <Badge color={STAGE_BY_KEY.lost.color}>Lost</Badge>}
                    {c.follow_up_at && c.stage !== 'lost' && (
                      <span
                        className={
                          'fu-chip' + (isOverdue(c.follow_up_at) ? ' overdue' : isDue(c.follow_up_at) ? ' due' : '')
                        }
                      >
                        {dueLabel(c.follow_up_at)}
                      </span>
                    )}
                  </div>
                  {c.address && <div className="small muted">{c.address}</div>}
                  {c.services?.length > 0 && <div className="small">{c.services.join(' · ')}</div>}
                  <div className="tiny muted">
                    {stage === 'client' && c.converted_at
                      ? `Client since ${timeAgo(c.converted_at)}`
                      : `Added ${timeAgo(c.created_at)}`}{' '}
                    by {nameOf(c.created_by)}
                    {c.source ? ` · ${c.source}` : ''}
                  </div>
                </Link>
                {c.phone && (
                  <a className="icon-btn call" href={telHref(c.phone)} aria-label={`Call ${c.name}`}>
                    <Icon name="phone" size={18} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
