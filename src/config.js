// Supabase connection. These two values are safe to keep in the code:
// the publishable key only works for people on your team list (see supabase/setup.sql).
// You can also set them as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in Vercel.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://wwdqllylizzarajdxfjc.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lypXn_JAZkKtYOn2o1jLDg_ICCFj5NI'

// Business info printed on estimates
export const BUSINESS = {
  name: 'Villa Landscaping',
  legalName: 'Villa Creations LLC',
  city: 'Calhoun, GA',
  website: 'villalandscapings.com',
  phone: '(770) 310-5428',
  email: 'villalandscaping2000@gmail.com',
}

// Shown as "Prepared by" on estimates, matched by login email
export const TEAM_CONTACTS = {
  'lukevillarruel24@gmail.com': { name: 'Luke Villarruel', phone: '(770) 310-5428' },
  'sebastian@svfarms.com': { name: 'Sebastian', phone: '(502) 888-9047' },
}

// Where the map opens before GPS kicks in (Calhoun, GA)
export const DEFAULT_CENTER = [34.5026, -84.9511]

// Satellite photos. Esri key is set in Vercel as VITE_ARCGIS_API_KEY.
// Without a key (or if Esri fails) the app falls back to free USGS aerial photos.
export const ARCGIS_KEY = import.meta.env.VITE_ARCGIS_API_KEY || ''
