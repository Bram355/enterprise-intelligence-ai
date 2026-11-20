import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { can } from '../../lib/permissions'
import { useAuth } from '../auth/auth-context'
import { AnalyticsPanel } from './AnalyticsPanel'
import { SystemStatusCard } from './SystemStatusCard'

const ROADMAP = [
  { phase: 1, name: 'Project foundation', state: 'Done' },
  { phase: 2, name: 'Supabase architecture, auth and roles', state: 'Done' },
  { phase: 3, name: 'Knowledge library and document processing', state: 'Done' },
  { phase: 4, name: 'AI provider and permission-aware retrieval', state: 'Done' },
  { phase: 5, name: 'AI assistant with citations and feedback', state: 'Done' },
  { phase: 6, name: 'Technical support module', state: 'Done' },
  { phase: 7, name: 'Administration and analytics', state: 'In review' },
  { phase: 8, name: 'Security and quality assurance', state: 'Planned' },
  { phase: 9, name: 'Deployment preparation', state: 'Planned' },
]

const SHORTCUTS = [
  { to: '/assistant', title: 'Ask the AI Assistant', text: 'Get answers with sources from documents you can access.' },
  { to: '/library', title: 'Browse the Knowledge Library', text: 'Find policies, guides and procedures.' },
  { to: '/support', title: 'Troubleshoot a problem', text: 'Step-by-step diagnosis with escalation advice.' },
]

export function DashboardPage() {
  const { profile } = useAuth()
  const isAdmin = can(profile?.role, 'admin.view')

  return (
    <>
      <PageHeader title="Dashboard" description={isAdmin ? 'Knowledge base health, usage and system status.' : 'Start here to find answers.'} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {isAdmin ? (
            <AnalyticsPanel />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {SHORTCUTS.map((s) => (
                <Link key={s.to} to={s.to} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.text}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <SystemStatusCard />
          <Card title="Build roadmap">
            <ol className="divide-y divide-slate-100 text-sm">
              {ROADMAP.map((item) => (
                <li key={item.phase} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-slate-700">
                    <span className="mr-2 font-mono text-xs text-slate-400">P{item.phase}</span>
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{item.state}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
