import { supabase } from './supabase.js'

// Address lookup: Geocodio first (through /api/reverse), OpenStreetMap's free
// Nominatim service as a backup and for the address search box.
// Nominatim's rules: no more than about 1 request per second, so we only look up
// when someone drops a pin or presses Search (never on every keystroke).

let lastCall = 0
async function throttle() {
  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

// Best address for a GPS point.
// 1) Geocodio (house-level, through our own /api/reverse so the key stays private)
// 2) OpenStreetMap as a backup
// Returns { address, options: [{address, hasNumber}], hasNumber, source }
export async function reverseGeocode(lat, lng) {
  const g = await geocodioReverse(lat, lng)
  if (g && g.options.length) {
    const withNum = g.options.filter((o) => o.hasNumber)
    const best = withNum[0] || g.options[0]
    return {
      address: best.address,
      hasNumber: best.hasNumber,
      options: (withNum.length ? withNum : g.options).slice(0, 5),
      source: 'geocodio',
    }
  }
  const osm = await osmReverse(lat, lng)
  return {
    address: osm.address,
    hasNumber: osm.hasNumber,
    options: osm.address ? [{ address: osm.address, hasNumber: osm.hasNumber }] : [],
    source: 'osm',
  }
}

async function geocodioReverse(lat, lng) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json.options) ? json : null
  } catch {
    return null
  }
}

async function osmReverse(lat, lng) {
  try {
    await throttle()
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { address: '', hasNumber: false }
    const data = await res.json()
    const a = data.address || {}
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    const town = a.city || a.town || a.village || a.hamlet || a.county || ''
    const line = [street, town, a.state ? stateAbbr(a.state) : ''].filter(Boolean).join(', ')
    return { address: line || data.display_name || '', hasNumber: !!a.house_number }
  } catch {
    return { address: '', hasNumber: false }
  }
}

export async function searchAddress(q, near) {
  try {
    await throttle()
    let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`
    if (near) {
      const [lat, lng] = near
      const d = 0.6
      url += `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}`
    }
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    return data.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name }))
  } catch {
    return []
  }
}

// Distance in meters between two points
export function distanceM(a, b) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const STATES = {
  Alabama: 'AL', Georgia: 'GA', Tennessee: 'TN', 'North Carolina': 'NC', 'South Carolina': 'SC',
  Florida: 'FL', Kentucky: 'KY', Mississippi: 'MS', Virginia: 'VA',
}
function stateAbbr(s) {
  return STATES[s] || s
}
