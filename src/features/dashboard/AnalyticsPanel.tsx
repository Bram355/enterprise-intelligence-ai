import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Card } from '../../components/ui/Card'
import { getAnalytics, type Analytics } from '../../services/analytics'

const PERIODS = [7, 30, 90]

const REASON_LABELS: Record<string, string> = { incorrect: 'Wrong answer', missing_docs: 'Missing documentation', other: 'Other' }

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
const label = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Stat({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function QuestionsChart({ perDay }: { perDay: Analytics['perDay'] }) {
  const max = Math.max(1, ...perDay.map((d) => d.total))
  return (
    <div>
      <div className="flex h-32 items-end gap-px" role="img" aria-label="Questions per day chart">
        {perDay.map((d) => (
          <div
            key={d.day}
            className="relative flex-1 rounded-t bg-brand-500"
            style={{ height: `${(d.total / max) * 100}%` }}
            title={`${shortDate(d.day)}: ${d.total} questions, ${d.unanswered} unanswered`}
          >
            <div className="absolute bottom-0 w-full rounded-t bg-amber-400" style={{ height: d.total ? `${(d.unanswered / d.total) * 100}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{perDay[0] && shortDate(perDay[0].day)}</span>
        <span>{perDay.at(-1) && shortDate(perDay.at(-1)!.day)}</span>
      </div>
      <p className="mt-2 flex gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-500" />Answered or other</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />Couldn't find</span>
      </p>
    </div>
  )
}

export function AnalyticsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getAnalytics(days).then((result) => {
      if (!active) return
      if (result.ok) {
        setData(result.value)
        setError(null)
      } else setError(result.error)
    })
    return () => {
      active = false
    }
  }, [days])

  if (error) return <Alert tone="error">{error}</Alert>
  if (!data) return <p className="text-sm text-slate-500">Loading analytics…</p>

  const { questions: q, feedback: f, documents: d, support: s, users: u } = data
  const rated = f.helpful + f.notHelpful

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Organisation analytics</h2>
        <label className="text-xs text-slate-600">
          <span className="mr-2">Period</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border-0 py-1 pl-2 pr-8 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>Last {p} days</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat title="Questions asked" value={q.total} hint={`${percent(q.answered, q.total)} answered`} />
        <Stat title="Couldn't find an answer" value={q.unanswered} hint={`${percent(q.unanswered, q.total)} of questions`} />
        <Stat title="Helpful rating" value={percent(f.helpful, rated)} hint={`${rated} ratings`} />
        <Stat title="People asking questions" value={u.askedQuestions} hint={`${u.active} active members`} />
        <Stat title="Documents indexed" value={`${d.indexed} / ${d.total}`} hint={`${d.added} added in period`} />
        <Stat title="Failed documents" value={d.failed} hint={`${d.processing} processing, ${d.archived} archived`} />
        <Stat title="Support cases" value={s.total} hint={`${s.open} open, ${s.resolved} resolved`} />
        <Stat title="Escalated cases" value={s.escalated} hint={percent(s.escalated, s.total) + ' of cases'} />
      </div>

      <Card title="Questions per day">
        <QuestionsChart perDay={data.perDay} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Documentation gaps (most common unanswered questions)">
          {data.topUnanswered.length === 0 ? (
            <p className="text-sm text-slate-500">No unanswered questions in this period.</p>
          ) : (
            <ol className="divide-y divide-slate-100 text-sm">
              {data.topUnanswered.map((item) => (
                <li key={item.question} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 break-words text-slate-800">{item.question}</span>
                  <span className="shrink-0 text-xs text-slate-500">{item.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Recent “not helpful” feedback">
          <p className="mb-2 text-xs text-slate-500">
            Wrong answer: {f.incorrect} · Missing documentation: {f.missingDocs}
          </p>
          {data.recentNegativeFeedback.length === 0 ? (
            <p className="text-sm text-slate-500">No negative feedback in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recentNegativeFeedback.map((item) => (
                <li key={item.createdAt + item.question} className="py-2">
                  <p className="text-slate-800">{item.question}</p>
                  <p className="text-xs text-slate-500">
                    {item.reason ? REASON_LABELS[item.reason] : 'No reason given'}
                    {item.comment && <> · “{item.comment}”</>} · {shortDate(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Most cited documents">
          {data.topDocuments.length === 0 ? (
            <p className="text-sm text-slate-500">No cited answers in this period.</p>
          ) : (
            <ol className="divide-y divide-slate-100 text-sm">
              {data.topDocuments.map((doc) => (
                <li key={doc.documentId} className="flex justify-between gap-3 py-2">
                  <Link to={`/library/${doc.documentId}`} className="min-w-0 break-words text-brand-700 hover:underline">{doc.title}</Link>
                  <span className="shrink-0 text-xs text-slate-500">{doc.count} answers</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Support cases by category">
          {Object.keys(s.byCategory).length === 0 ? (
            <p className="text-sm text-slate-500">No support cases in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {Object.entries(s.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <li key={category} className="flex justify-between py-2">
                    <span className="text-slate-800">{label(category)}</span>
                    <span className="text-xs text-slate-500">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Failed documents">
        {data.failedDocuments.length === 0 ? (
          <p className="text-sm text-slate-500">No failed documents. Everything uploaded was processed.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.failedDocuments.map((doc) => (
                <li key={doc.id} className="py-2">
                  <Link to={`/library/${doc.id}`} className="font-medium text-brand-700 hover:underline">{doc.title}</Link>
                  <p className="text-xs text-red-700">{doc.error ?? 'No reason recorded.'}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">To retry, open the document and upload a new version of the file.</p>
          </>
        )}
      </Card>
    </div>
  )
}
