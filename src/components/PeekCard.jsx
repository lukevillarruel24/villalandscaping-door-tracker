import { STATUS_BY_KEY } from '../lib/constants.js'
import { timeAgo } from '../lib/format.js'
import { Icon } from './Icon.jsx'

// Bottom card shown after pressing and holding on the map:
// the address of that spot, nearby house numbers, and quick actions.
export default function PeekCard({ peek, onClose, onLog, onOpenDoor, onPickOption }) {
  const { status, result, near, chosen } = peek
  const others = (result?.options || []).filter((o) => o.address !== chosen?.address).slice(0, 4)

  return (
    <div className="peek-card card" role="dialog" aria-label="Address at this spot">
      <div className="row between gap-sm">
        <div className="peek-main">
          <div className="label">{status === 'loading' ? 'Looking up this house…' : 'Address here'}</div>
          {status === 'loading' && <div className="peek-skeleton" />}
          {status === 'done' && chosen && <div className="peek-addr">{chosen.address}</div>}
          {status === 'done' && !chosen && (
            <div className="peek-addr muted">No address found for this spot. Try pressing right on the roof.</div>
          )}
          {status === 'done' && chosen && !chosen.hasNumber && (
            <div className="tiny muted">No house number on file here. Check the mailbox.</div>
          )}
        </div>
        <button className="icon-btn sm" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>

      {status === 'done' && others.length > 0 && (
        <div className="peek-others">
          <span className="tiny muted">Not it? Nearby:</span>
          <div className="chip-row">
            {others.map((o) => (
              <button key={o.address} className="chip" onClick={() => onPickOption(o)}>
                {o.address.split(',')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {near && (
        <button className="peek-near" onClick={() => onOpenDoor(near.door.id)}>
          <span className="dot" style={{ background: STATUS_BY_KEY[near.door.status]?.color }} />
          <span className="grow">
            Already knocked: <b>{STATUS_BY_KEY[near.door.status]?.label}</b>
            <span className="muted"> · {timeAgo(near.door.updated_at)}</span>
          </span>
          <span className="small">Open →</span>
        </button>
      )}

      <div className="row gap-sm mt-sm">
        <button className="btn primary grow" disabled={status === 'loading'} onClick={onLog}>
          <Icon name="plus" size={16} stroke={2.6} /> {near ? 'Log as a new door' : 'Log this door'}
        </button>
      </div>
    </div>
  )
}
