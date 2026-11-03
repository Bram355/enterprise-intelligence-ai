import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from '../config/env'

const env = readSupabaseEnv()

export const supabase: SupabaseClient | null = env ? createClient(env.url, env.publishableKey) : null
export const supabaseEnv = env
