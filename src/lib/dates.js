// Date helpers. Everything uses the phone's local time zone.

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const endOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const atTime = (d, h, m = 0) => {
  const x = new Date(d)
  x.setHours(h, m, 0, 0)
  return x
}

// "2026-11-18" in local time
export function dayKey(d) {
  const x = new Date(d)
  const mm = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${mm}-${dd}`
}
export const fromDayKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const fmtDay = (d) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const fmtShortDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function startOfWeek(d = new Date()) {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // Monday
  return x
}

// Quick choices for "when should we follow up?"
export function followUpChoices(now = new Date()) {
  const today6 = atTime(now, 18)
  const laterToday = now < atTime(now, 17) ? today6 : new Date(now.getTime() + 60 * 60 * 1000)
  const sat = addDays(startOfDay(now), ((6 - now.getDay() + 7) % 7) || 7)
  return [
    { key: 'today', label: 'Later today', date: laterToday },
    { key: 'tomorrow', label: 'Tomorrow', date: atTime(addDays(now, 1), 17) },
    { key: 'sat', label: 'Saturday', date: atTime(sat, 10) },
    { key: 'week', label: 'Next week', date: atTime(addDays(now, 7), 17) },
  ]
}

export const isDue = (d, now = new Date()) => !!d && new Date(d) <= endOfDay(now)
export const isOverdue = (d, now = new Date()) => !!d && new Date(d) < startOfDay(now)

// "Overdue (Nov 15)", "Today 6:00 PM", "Tomorrow", "Sat, Nov 22"
export function dueLabel(d, now = new Date()) {
  if (!d) return ''
  const x = new Date(d)
  if (isOverdue(x, now)) return `Overdue (${x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
  if (dayKey(x) === dayKey(now)) return `Today ${fmtTime(x)}`
  if (dayKey(x) === dayKey(addDays(now, 1))) return `Tomorrow ${fmtTime(x)}`
  return `${fmtDay(x)} ${fmtTime(x)}`
}

// Value for <input type="datetime-local">
export function toLocalInput(d) {
  if (!d) return ''
  const x = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}
