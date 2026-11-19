// Vercel serverless function: turns a GPS point into a street address using Geocodio.
// The Geocodio key stays here on the server (Vercel env var GEOCODIO_API_KEY),
// so it never ships to the phone. Only signed-in app users can call this.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wwdqllylizzarajdxfjc.supabase.co'
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lypXn_JAZkKtYOn2o1jLDg_ICCFj5NI'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'bad_coordinates' })
  }

  const key = process.env.GEOCODIO_API_KEY
  if (!key) return res.status(501).json({ error: 'not_configured' })

  // Only people signed in to the app may use the lookup
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'not_signed_in' })
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!who.ok) return res.status(401).json({ error: 'not_signed_in' })
  } catch {
    return res.status(502).json({ error: 'auth_check_failed' })
  }

  try {
    const url = `https://api.geocod.io/v2.1/reverse?q=${lat},${lng}&limit=6&api_key=${encodeURIComponent(key)}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(502).json({ error: 'geocodio_' + r.status })
    const data = await r.json()
    const seen = new Set()
    const options = []
    for (const x of data.results || []) {
      const label = formatAddress(x)
      if (!label || seen.has(label)) continue
      seen.add(label)
      options.push({
        address: label,
        hasNumber: !!x.address_components?.number,
        accuracy: x.accuracy_type || null,
      })
    }
    return res.status(200).json({ source: 'geocodio', options })
  } catch {
    return res.status(502).json({ error: 'geocodio_unreachable' })
  }
}

function formatAddress(x) {
  const c = x.address_components || {}
  const street = [c.number, c.formatted_street || [c.street, c.suffix].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' ')
  const place = [c.city, [c.state, c.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const line = [street, place].filter(Boolean).join(', ')
  return line || x.formatted_address || ''
}
