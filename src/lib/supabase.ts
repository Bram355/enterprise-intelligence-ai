import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from '../config/env'
import type { Database } from '../types/database'

const env = readSupabaseEnv()

export type AppSupabaseClient = SupabaseClient<Database>

export const supabase: AppSupabaseClient | null = env
  ? createClient<Database>(env.url, env.publishableKey, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null
export const supabaseEnv = env

export function requireSupabase(): AppSupabaseClient {
  if (!supabase) throw new Error('The backend is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  return supabase
}
