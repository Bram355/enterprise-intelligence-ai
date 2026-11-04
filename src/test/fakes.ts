import type { Session } from '@supabase/supabase-js'
import type { AuthContextValue } from '../features/auth/auth-context'
import type { Profile, Role } from '../types/domain'

export function fakeProfile(role: Role = 'employee'): Profile {
  return {
    id: 'user-1',
    email: `${role}@northwind.test`,
    fullName: 'Test Person',
    role,
    isActive: true,
    organisationId: 'org-1',
    organisationName: 'Northwind Payments',
    departmentId: null,
    departmentName: null,
  }
}

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'signed_in',
    session: { user: { id: 'user-1', email: 'employee@northwind.test' } } as Session,
    profile: fakeProfile(),
    refreshProfile: async () => {},
    signOut: async () => {},
    ...overrides,
  }
}
