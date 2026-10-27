import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseAvailable =
  isValidUrl(supabaseUrl) && !!supabaseAnonKey

export const supabase = isSupabaseAvailable
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
