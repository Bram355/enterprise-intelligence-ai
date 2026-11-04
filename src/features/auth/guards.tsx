import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { can, type Permission } from '../../lib/permissions'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './auth-context'

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, signOut, refreshProfile } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unconfigured') {
    return (
      <AuthLayout title="Backend not configured" description="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the app." >
        <span />
      </AuthLayout>
    )
  }
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (status === 'no_profile' || status === 'error') {
    return (
      <AuthLayout
        title={status === 'error' ? 'Could not load your account' : 'Account not available'}
        description={
          status === 'error'
            ? 'There was a problem loading your profile. Please try again.'
            : 'Your account is not active or has not been set up. Contact your organisation administrator.'
        }
      >
        <div className="flex gap-2">
          {status === 'error' && <Button onClick={() => void refreshProfile()}>Try again</Button>}
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </AuthLayout>
    )
  }
  return children ?? <Outlet />
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { profile } = useAuth()
  if (!can(profile?.role, permission)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">You don't have access to this page</h1>
        <p className="mt-1 text-sm text-slate-600">Ask your organisation administrator if you need access.</p>
      </div>
    )
  }
  return children
}
