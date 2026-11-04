import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'
import { SystemStatusCard } from './SystemStatusCard'

const ROADMAP = [
  { phase: 1, name: 'Project foundation', state: 'Done' },
  { phase: 2, name: 'Supabase architecture, auth and roles', state: 'In review' },
  { phase: 3, name: 'Knowledge library and document processing', state: 'Planned' },
  { phase: 4, name: 'AI provider and permission-aware retrieval', state: 'Planned' },
  { phase: 5, name: 'AI assistant with citations and feedback', state: 'Planned' },
  { phase: 6, name: 'Technical support module', state: 'Planned' },
  { phase: 7, name: 'Administration and analytics', state: 'Planned' },
  { phase: 8, name: 'Security and quality assurance', state: 'Planned' },
  { phase: 9, name: 'Deployment preparation', state: 'Planned' },
]

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Knowledge base health, usage and system status." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PlannedFeature
            phase={7}
            summary="Live metrics will appear here once documents, questions and users exist in the database. No figures are shown until they are real."
            capabilities={[
              'Total and processed documents',
              'Failed document processing',
              'Recent uploads and questions',
              'Most searched topics',
              'User activity',
              'Knowledge gaps from feedback',
            ]}
          />
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
        <SystemStatusCard />
      </div>
    </>
  )
}
