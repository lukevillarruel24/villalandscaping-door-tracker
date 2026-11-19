import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon.jsx'
import { STATUSES } from '../lib/constants.js'
import { dueLabel, followUpChoices, toLocalInput } from '../lib/dates.js'

export function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="sheet-wrap">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function StatusPicker({ value, onChange, disabled }) {
  return (
    <div className="status-grid">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          type="button"
          disabled={disabled}
          className={'status-btn' + (value === s.key ? ' on' : '')}
          style={{ '--c': s.color }}
          onClick={() => onChange(s.key)}
        >
          <span className="dot" />
          {s.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ color, children }) {
  return (
    <span className="badge" style={{ '--c': color }}>
      {children}
    </span>
  )
}

export function PageHeader({ title, back, right, sub }) {
  const nav = useNavigate()
  return (
    <header className="page-head">
      {back && (
        <button className="icon-btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav(back))} aria-label="Back">
          <Icon name="back" />
        </button>
      )}
      <div className="page-head-text">
        <h1>{title}</h1>
        {sub && <div className="muted small">{sub}</div>}
      </div>
      <div className="page-head-right">{right}</div>
    </header>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <div className="muted">{children}</div>}
    </div>
  )
}

// "When should we come back / follow up?" quick picks + exact date
export function FollowUpPicker({ value, onChange, allowClear = true }) {
  const choices = followUpChoices()
  const [custom, setCustom] = useState(false)
  const selectedKey = value
    ? choices.find((c) => Math.abs(new Date(value) - c.date) < 60000)?.key || 'custom'
    : null
  return (
    <div className="followup">
      <div className="chip-row">
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            className={'chip toggle' + (selectedKey === c.key ? ' on' : '')}
            onClick={() => {
              setCustom(false)
              onChange(c.date.toISOString())
            }}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={'chip toggle' + (selectedKey === 'custom' || custom ? ' on' : '')}
          onClick={() => setCustom(true)}
        >
          Pick date
        </button>
        {allowClear && value && (
          <button type="button" className="chip" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      {(custom || selectedKey === 'custom') && (
        <input
          type="datetime-local"
          className="mt-sm"
          value={toLocalInput(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      )}
      {value && <div className="tiny muted mt-sm">Set for {dueLabel(value)}</div>}
    </div>
  )
}
