import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { checkSupabaseHealth, type HealthState } from '../../lib/health'
import { supabaseEnv } from '../../lib/supabase'

export function SystemStatusCard() {
  const [health, setHealth] = useState<HealthState | null>(null)

  useEffect(() => {
    let active = true
    checkSupabaseHealth(supabaseEnv).then((result) => {
      if (active) setHealth(result)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card title="System health" className="self-start">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Frontend</dt>
          <dd>
            <Badge tone="success">Running</Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Backend (Supabase)</dt>
          <dd aria-live="polite">
            {health === null && <Badge>Checking…</Badge>}
            {health?.status === 'ok' && <Badge tone="success">Connected · {health.latencyMs} ms</Badge>}
            {health?.status === 'not_configured' && <Badge tone="warning">Not configured</Badge>}
            {health?.status === 'error' && <Badge tone="danger">{health.message}</Badge>}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">AI provider</dt>
          <dd>
            <Badge>Not connected (Phase 4)</Badge>
          </dd>
        </div>
      </dl>
    </Card>
  )
}
