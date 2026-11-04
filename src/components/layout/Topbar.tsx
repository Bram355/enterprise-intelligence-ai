import { Menu, UserCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../../config/navigation'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))

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
      <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
        <UserCircle className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">Not signed in · sign-in arrives in Phase 2</span>
      </div>
    </header>
  )
}
