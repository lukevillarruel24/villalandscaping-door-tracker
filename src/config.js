// Supabase connection. These two values are safe to keep in the code:
// the anon key only works for people on your team list (see supabase/setup.sql).
// You can also set them as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in Vercel.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'PASTE_SUPABASE_PROJECT_URL_HERE'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'PASTE_SUPABASE_ANON_KEY_HERE'

// Business info printed on estimates
export const BUSINESS = {
  name: 'Villa Landscaping',
  legalName: 'Villa Creations LLC',
  city: 'Calhoun, GA',
  website: 'villalandscapings.com',
  phone: '',
  email: '',
}

// Where the map opens before GPS kicks in (Calhoun, GA)
export const DEFAULT_CENTER = [34.5026, -84.9511]
