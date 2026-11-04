import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { fetchProfile, signOut as signOutRequest } from '../../services/auth'
import type { Profile } from '../../types/domain'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

interface ProfileEntry {
  userId: string | null
  profile: Profile | null
  failed: boolean
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profileEntry, setProfileEntry] = useState<ProfileEntry>({ userId: null, profile: null, failed: false })

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionLoaded(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(
    (id: string) =>
      fetchProfile(id).then(
        (profile) => setProfileEntry({ userId: id, profile, failed: false }),
        () => setProfileEntry({ userId: id, profile: null, failed: true }),
      ),
    [],
  )

  useEffect(() => {
    if (userId) void loadProfile(userId)
  }, [userId, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [userId, loadProfile])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setSession(null)
  }, [])

  const status: AuthStatus = !supabase
    ? 'unconfigured'
    : !sessionLoaded
      ? 'loading'
      : !session
        ? 'signed_out'
        : profileEntry.userId !== userId
          ? 'loading'
          : profileEntry.failed
            ? 'error'
            : profileEntry.profile
              ? 'signed_in'
              : 'no_profile'
  const profile = status === 'signed_in' ? profileEntry.profile : null

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profile, refreshProfile, signOut }),
    [status, session, profile, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
