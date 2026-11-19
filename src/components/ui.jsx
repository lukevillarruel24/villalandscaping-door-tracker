import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon.jsx'
import { STATUSES } from '../lib/constants.js'

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
