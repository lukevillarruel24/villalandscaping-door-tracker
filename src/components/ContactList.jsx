import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { timeAgo, telHref } from '../lib/format.js'
import { PageHeader, Empty, Badge } from './ui.jsx'
import { Icon } from './Icon.jsx'
import { STAGE_BY_KEY } from '../lib/constants.js'

export default function ContactList({ stage }) {
  const { contacts, nameOf } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [showLost, setShowLost] = useState(false)

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return contacts
      .filter((c) => c.stage === stage || (stage === 'lead' && showLost && c.stage === 'lost'))
      .filter(
        (c) =>
          !term ||
          [c.name, c.address, c.phone, c.email, ...(c.services || [])]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(term)),
      )
      .sort((a, b) =>
        stage === 'client'
          ? new Date(b.converted_at || b.created_at) - new Date(a.converted_at || a.created_at)
          : new Date(b.created_at) - new Date(a.created_at),
      )
  }, [contacts, stage, q, showLost])

  const lostCount = contacts.filter((c) => c.stage === 'lost').length
  const title = stage === 'client' ? 'Clients' : 'Leads'

  return (
    <div className="page">
      <PageHeader
        title={title}
        sub={`${list.length} ${list.length === 1 ? title.slice(0, -1).toLowerCase() : title.toLowerCase()}`}
        right={
          stage === 'lead' && (
            <button className="btn primary sm" onClick={() => nav('/contacts/new')}>
              <Icon name="plus" size={16} /> New
            </button>
          )
        }
      />
      <div className="page-body">
        <div className="search-bar flat">
          <Icon name="search" size={18} />
          <input placeholder="Search name, address, phone, service" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {stage === 'lead' && lostCount > 0 && (
          <label className="check-row">
            <input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} />
            Show lost leads ({lostCount})
          </label>
        )}

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
                  <div className="row gap-sm">
                    <b>{c.name}</b>
                    {c.stage === 'lost' && <Badge color={STAGE_BY_KEY.lost.color}>Lost</Badge>}
                  </div>
                  {c.address && <div className="small muted">{c.address}</div>}
                  {c.services?.length > 0 && <div className="small">{c.services.join(' · ')}</div>}
                  <div className="tiny muted">
                    {stage === 'client' && c.converted_at
                      ? `Client since ${timeAgo(c.converted_at)}`
                      : `Added ${timeAgo(c.created_at)}`}{' '}
                    by {nameOf(c.created_by)}
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
