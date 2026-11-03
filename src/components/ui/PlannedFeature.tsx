import { Clock } from 'lucide-react'
import { Badge } from './Badge'
import { Card } from './Card'

interface PlannedFeatureProps {
  phase: number
  summary: string
  capabilities: string[]
}

export function PlannedFeature({ phase, summary, capabilities }: PlannedFeatureProps) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
          <Clock className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Not built yet</h2>
            <Badge tone="warning">Planned for Phase {phase}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{summary}</p>
          <ul className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
            {capabilities.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
