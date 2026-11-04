import { describe, expect, it } from 'vitest'
import { readSupabaseEnv } from './env'

describe('readSupabaseEnv', () => {
  it('returns null when values are missing', () => {
    expect(readSupabaseEnv({})).toBeNull()
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBeNull()
  })

  it('returns null for an invalid URL', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
  })

  it('resolves a path against the current origin', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: '/supabase', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }, 'https://app.example.com'),
    ).toEqual({ url: 'https://app.example.com/supabase', publishableKey: 'k' })
  })

  it('rejects a path when there is no origin', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: '/supabase', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }, null)).toBeNull()
  })

  it('trims values and strips trailing slashes', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: ' http://127.0.0.1:54321/ ', VITE_SUPABASE_PUBLISHABLE_KEY: ' key ' }),
    ).toEqual({ url: 'http://127.0.0.1:54321', publishableKey: 'key' })
  })
})
