const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const fmtMoney = (n) => money.format(Number(n) || 0)

export function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeAgo(d) {
  if (!d) return ''
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return fmtDate(d)
}

export function estimateTotals(items, taxRate) {
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
    0,
  )
  const tax = subtotal * ((Number(taxRate) || 0) / 100)
  return { subtotal, tax, total: subtotal + tax }
}

export const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '')
export const smsHref = (p) => 'sms:' + String(p || '').replace(/[^\d+]/g, '')

export function directionsHref(c) {
  const dest = c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : c.address || ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}
