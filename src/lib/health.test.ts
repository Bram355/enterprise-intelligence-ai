import { describe, expect, it, vi } from 'vitest'
import { checkSupabaseHealth } from './health'

const env = { url: 'http://127.0.0.1:54321', publishableKey: 'pk' }

describe('checkSupabaseHealth', () => {
  it('reports not configured without env', async () => {
    expect(await checkSupabaseHealth(null)).toEqual({ status: 'not_configured' })
  })

  it('calls the auth health endpoint with the publishable key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const result = await checkSupabaseHealth(env, fetchMock)
    expect(result.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/auth/v1/health',
      expect.objectContaining({ headers: { apikey: 'pk' } }),
    )
  })

  it('reports HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    expect(await checkSupabaseHealth(env, fetchMock)).toEqual({
      status: 'error',
      message: 'Backend responded with HTTP 503',
    })
  })

  it('reports network failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await checkSupabaseHealth(env, fetchMock)).toEqual({ status: 'error', message: 'Backend is unreachable' })
  })
})
