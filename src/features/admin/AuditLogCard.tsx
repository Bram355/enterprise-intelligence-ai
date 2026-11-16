import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { describeAudit, listAuditLog, PAGE_SIZE, type AuditEntry } from '../../services/analytics'

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'member.', label: 'Members' },
  { value: 'invitation.', label: 'Invitations' },
  { value: 'department.', label: 'Departments' },
  { value: 'document.', label: 'Documents' },
  { value: 'support_case.', label: 'Support cases' },
]

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function AuditLogCard({ refreshKey }: { refreshKey: number }) {
  const [filter, setFilter] = useState('')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listAuditLog({ action: filter || undefined }).then((result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) return setError(result.error)
      setError(null)
      setEntries(result.value)
      setHasMore(result.value.length === PAGE_SIZE)
    })
    return () => {
      active = false
    }
  }, [filter, refreshKey])

  async function loadMore() {
    const last = entries.at(-1)
    if (!last) return
    const result = await listAuditLog({ action: filter || undefined, before: last.id })
    if (!result.ok) return setError(result.error)
    setEntries((all) => [...all, ...result.value])
    setHasMore(result.value.length === PAGE_SIZE)
  }

  return (
    <Card title="Audit log">
      <div className="mb-3">
        <label htmlFor="audit-filter" className="mr-2 text-xs text-slate-600">
          Show
        </label>
        <select
          id="audit-filter"
          value={filter}
          onChange={(e) => {
            setLoading(true)
            setFilter(e.target.value)
          }}
          className="rounded-lg border-0 py-1 pl-2 pr-8 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <span className="min-w-0 text-slate-800">
                <span className="font-medium">{e.actorName ?? 'System'}</span> · {describeAudit(e)}
              </span>
              <time dateTime={e.createdAt} className="shrink-0 text-xs text-slate-500">
                {formatTime(e.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      {hasMore && !loading && (
        <Button variant="secondary" className="mt-3" onClick={() => void loadMore()}>
          Load more
        </Button>
      )}
    </Card>
  )
}
