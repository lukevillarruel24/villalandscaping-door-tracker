import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { BUSINESS } from '../config.js'
import { estimateTotals, fmtDate, fmtMoney } from '../lib/format.js'
import { Icon } from './Icon.jsx'

export default function EstimatePrint() {
  const { id } = useParams()
  const { contacts } = useStore()
  const nav = useNavigate()
  const [est, setEst] = useState(null)

  useEffect(() => {
    supabase
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setEst(data || false))
  }, [id])

  if (est === null) return <div className="splash"><div className="spinner" /></div>
  if (est === false) return <div className="center-page">Estimate not found.</div>

  const c = contacts.find((x) => x.id === est.contact_id) || {}
  const items = (est.estimate_items || []).sort((a, b) => a.position - b.position)
  const t = estimateTotals(items, est.tax_rate)

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button className="btn" onClick={() => nav(`/estimates/${id}`)}>
          <Icon name="back" size={16} /> Back
        </button>
        <button className="btn primary" onClick={() => window.print()}>
          <Icon name="print" size={16} /> Print / Save PDF
        </button>
      </div>

      <div className="doc">
        <div className="doc-head">
          <div>
            <div className="doc-brand">{BUSINESS.name}</div>
            <div className="muted small">
              {BUSINESS.legalName}
              <br />
              {BUSINESS.city}
              {BUSINESS.phone && <><br />{BUSINESS.phone}</>}
              {BUSINESS.email && <><br />{BUSINESS.email}</>}
              <br />
              {BUSINESS.website}
            </div>
          </div>
          <div className="doc-meta">
            <div className="doc-title">ESTIMATE</div>
            <div>#{est.number}</div>
            <div>{fmtDate(est.created_at)}</div>
          </div>
        </div>

        <div className="doc-client">
          <div className="label">Prepared for</div>
          <b>{c.name}</b>
          {c.address && <div>{c.address}</div>}
          {c.phone && <div>{c.phone}</div>}
          {c.email && <div>{c.email}</div>}
        </div>

        <h2 className="doc-project">{est.title}</h2>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td className="num qty">
                  {Number(it.qty)} {it.unit || ''}
                </td>
                <td className="num">{fmtMoney(it.unit_price)}</td>
                <td className="num">{fmtMoney(Number(it.qty) * Number(it.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-totals">
          <div>
            <span>Subtotal</span>
            <span>{fmtMoney(t.subtotal)}</span>
          </div>
          {Number(est.tax_rate) > 0 && (
            <div>
              <span>Tax ({Number(est.tax_rate)}%)</span>
              <span>{fmtMoney(t.tax)}</span>
            </div>
          )}
          <div className="grand">
            <span>Total</span>
            <span>{fmtMoney(t.total)}</span>
          </div>
        </div>

        {est.notes && (
          <div className="doc-notes">
            <div className="label">Notes</div>
            <div className="pre">{est.notes}</div>
          </div>
        )}

        <div className="doc-sign">
          <div>
            <div className="sign-line" />
            Accepted by
          </div>
          <div>
            <div className="sign-line" />
            Date
          </div>
        </div>
      </div>
    </div>
  )
}
