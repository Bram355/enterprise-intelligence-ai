export interface SupabaseEnv {
  url: string
  publishableKey: string
}

type RawEnv = Record<string, string | boolean | undefined>

const browserOrigin = typeof window === 'undefined' ? null : window.location.origin

/**
 * VITE_SUPABASE_URL may be absolute (https://xyz.supabase.co) or a path such as
 * `/supabase`, which is resolved against the current origin and served by the
 * Vite dev-server proxy (see vite.config.ts).
 */
export function readSupabaseEnv(env: RawEnv = import.meta.env, origin: string | null = browserOrigin): SupabaseEnv | null {
  const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const publishableKey =
    typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : ''
  if (!rawUrl || !publishableKey) return null
  let url: URL
  try {
    url = rawUrl.startsWith('/') && origin ? new URL(rawUrl, origin) : new URL(rawUrl)
  } catch {
    return null
  }
  return { url: url.href.replace(/\/+$/, ''), publishableKey }
}
