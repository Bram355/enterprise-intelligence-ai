import { LogOut, Menu, UserCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../../config/navigation'
import { useAuth } from '../../features/auth/auth-context'
import { ROLE_LABELS } from '../../types/domain'
import { Badge } from '../ui/Badge'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const current =
    pathname === '/profile'
      ? { label: 'Your profile' }
      : NAV_ITEMS.find((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="app-sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="truncate text-sm font-medium text-slate-700">{current?.label ?? 'Enterprise Intelligence AI'}</span>
      {profile && (
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            aria-label="Your profile"
          >
            <UserCircle className="h-5 w-5 text-slate-500" aria-hidden />
            <span className="hidden max-w-40 truncate sm:inline">{profile.fullName || profile.email}</span>
            <span className="hidden md:inline">
              <Badge tone="info">{ROLE_LABELS[profile.role]}</Badge>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      )}
    </header>
  )
}
