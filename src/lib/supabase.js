import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('PASTE_')

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const PHOTO_BUCKET = 'job-photos'
