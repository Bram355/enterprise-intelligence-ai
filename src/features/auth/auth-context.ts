import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../../types/domain'

export type AuthStatus = 'loading' | 'unconfigured' | 'signed_out' | 'signed_in' | 'no_profile' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
