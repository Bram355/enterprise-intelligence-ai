export interface SupabaseEnv {
  url: string
  publishableKey: string
}

type RawEnv = Record<string, string | boolean | undefined>

export function readSupabaseEnv(env: RawEnv = import.meta.env): SupabaseEnv | null {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const publishableKey =
    typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : ''
  if (!url || !publishableKey) return null
  try {
    new URL(url)
  } catch {
    return null
  }
  return { url: url.replace(/\/+$/, ''), publishableKey }
}
