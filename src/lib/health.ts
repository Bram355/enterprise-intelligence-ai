import type { SupabaseEnv } from '../config/env'

export type HealthState =
  | { status: 'not_configured' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'error'; message: string }

export async function checkSupabaseHealth(
  env: SupabaseEnv | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<HealthState> {
  if (!env) return { status: 'not_configured' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetchImpl(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.publishableKey },
      signal: controller.signal,
    })
    if (!res.ok) return { status: 'error', message: `Backend responded with HTTP ${res.status}` }
    return { status: 'ok', latencyMs: Math.round(performance.now() - started) }
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    return { status: 'error', message: aborted ? 'Backend did not respond in time' : 'Backend is unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
