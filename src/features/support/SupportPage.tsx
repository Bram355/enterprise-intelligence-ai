import { Check, ClipboardCopy, FileText, LifeBuoy, Plus, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../auth/auth-context'
import {
  buildHandoff,
  diagnose,
  getCase,
  listCases,
  MAX_PROBLEM_CHARS,
  setCaseStatus,
  setStepOutcome,
  shouldEscalate,
  SUPPORT_CATEGORIES,
  type CaseStatus,
  type CaseSummary,
  type Environment,
  type StepOutcome,
  type SupportCase,
  type SupportCategory,
} from '../../services/support'

const STATUS_TONE: Record<CaseStatus, BadgeTone> = { open: 'info', resolved: 'success', escalated: 'warning' }
const STATUS_LABEL: Record<CaseStatus, string> = { open: 'Open', resolved: 'Resolved', escalated: 'Escalated' }
const inputClass =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600'

function Cites({ numbers, caseId }: { numbers: number[]; caseId: string }) {
  return (
    <>
      {numbers.map((n) => (
        <a key={n} href={`#case-${caseId}-source-${n}`} aria-label={`Source ${n}`} className="ml-1 rounded bg-brand-50 px-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
          {n}
        </a>
      ))}
    </>
  )
}

function NewCaseForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [category, setCategory] = useState<SupportCategory>('api_auth')
  const [errorCode, setErrorCode] = useState('')
  const [environment, setEnvironment] = useState<Environment>('unknown')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (problem.trim().length < 10) return setError('Describe the problem in at least 10 characters.')
    setError(null)
    setBusy(true)
    const result = await diagnose({ category, problem: problem.trim(), errorCode, environment })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    onCreated(result.value.caseId)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4" aria-label="Describe a technical problem" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} className={inputClass}>
              {Object.entries(SUPPORT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="errorCode" className="mb-1 block text-sm font-medium text-slate-700">Error code (optional)</label>
            <input id="errorCode" value={errorCode} maxLength={40} onChange={(e) => setErrorCode(e.target.value)} placeholder="e.g. PAY-401, T-102, 429" className={inputClass} />
          </div>
          <div>
            <label htmlFor="environment" className="mb-1 block text-sm font-medium text-slate-700">Environment</label>
            <select id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)} className={inputClass}>
              <option value="unknown">Not sure</option>
              <option value="sandbox">Sandbox / test</option>
              <option value="live">Live / production</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="problem" className="mb-1 block text-sm font-medium text-slate-700">What is happening?</label>
          <textarea id="problem" rows={4} maxLength={MAX_PROBLEM_CHARS} value={problem} onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. The till terminal in store 14 shows T-102 and won't take card payments since this morning."
            className={inputClass} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Only documents you can access are used. Don't include card numbers or passwords.</span>
          <Button type="submit" loading={busy}>
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Diagnose
          </Button>
        </div>
        {busy && <Spinner label="Searching your documents and building a diagnosis…" />}
      </form>
    </Card>
  )
}

function CaseView({ value, onChange }: { value: SupportCase; onChange: (c: SupportCase) => void }) {
  const { profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isOwner = profile?.id === value.userId
  const escalate = shouldEscalate(value)
  const handoff = buildHandoff(value)

  async function mark(stepId: number, outcome: StepOutcome) {
    const result = await setStepOutcome(stepId, outcome)
    if (!result.ok) return setError(result.error)
    const steps = value.steps.map((s) => (s.id === stepId ? { ...s, outcome } : s))
    let status = value.status
    if (outcome === 'fixed' && status === 'open') {
      const closed = await setCaseStatus(value.id, 'resolved')
      if (closed.ok) status = 'resolved'
    }
    onChange({ ...value, steps, status })
  }

  async function changeStatus(status: CaseStatus) {
    const result = await setCaseStatus(value.id, status)
    if (!result.ok) return setError(result.error)
    onChange({ ...value, status })
  }

  async function copyHandoff() {
    await navigator.clipboard?.writeText(handoff)
    setCopied(true)
  }

  const outcomeButton = (stepId: number, current: StepOutcome, outcome: StepOutcome, label: string, Icon: typeof Check) => (
    <button type="button" disabled={!isOwner} aria-pressed={current === outcome} onClick={() => void mark(stepId, current === outcome ? 'pending' : outcome)}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ring-1 ring-inset disabled:cursor-not-allowed ${
        current === outcome ? 'bg-brand-600 text-white ring-brand-600' : 'text-slate-700 ring-slate-300 hover:bg-slate-50'
      }`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{value.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {SUPPORT_CATEGORIES[value.category]}
              {value.errorCode && ` · ${value.errorCode}`} · {value.environment === 'unknown' ? 'environment not given' : value.environment}
            </p>
          </div>
          <Badge tone={STATUS_TONE[value.status]}>{STATUS_LABEL[value.status]}</Badge>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{value.problem}</p>
        {value.summary && (
          <p className="mt-3 text-sm text-slate-900"><span className="font-medium">In short:</span> {value.summary}</p>
        )}
      </Card>

      {value.steps.length === 0 ? (
        <Alert tone="info">No document you can access covers this problem, so there are no diagnostic steps. Escalate it using the summary below.</Alert>
      ) : (
        <>
          {value.causes.length > 0 && (
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Likely causes</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                {value.causes.map((c, i) => (
                  <li key={i}>{c.text}<Cites numbers={c.citations} caseId={value.id} /></li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Diagnostic steps</h3>
            <p className="mb-3 text-xs text-slate-500">Try them in order and record what happened.</p>
            <ol className="space-y-3">
              {value.steps.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 p-3" aria-label={`Step ${s.position}`}>
                  <p className="text-sm text-slate-900"><span className="font-semibold">{s.position}.</span> {s.action}<Cites numbers={s.citations} caseId={value.id} /></p>
                  {s.expected && <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Expected:</span> {s.expected}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {outcomeButton(s.id, s.outcome, 'fixed', 'Fixed it', Check)}
                    {outcomeButton(s.id, s.outcome, 'not_fixed', "Didn't help", X)}
                    {outcomeButton(s.id, s.outcome, 'skipped', 'Skip', SkipForward)}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}

      {value.status === 'resolved' && <Alert tone="success">Marked as resolved. Reopen it if the problem comes back.</Alert>}

      {(escalate || value.status === 'escalated') && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Escalation</h3>
          {value.escalation ? (
            <p className="text-sm text-slate-800">{value.escalation.text}<Cites numbers={value.escalation.citations} caseId={value.id} /></p>
          ) : (
            <p className="text-sm text-slate-800">The documentation doesn't name a team for this. Send the summary below to your team lead or the support team.</p>
          )}
          <label htmlFor={`handoff-${value.id}`} className="mt-3 block text-xs font-medium text-slate-600">Handoff summary</label>
          <textarea id={`handoff-${value.id}`} readOnly rows={8} value={handoff} className={`${inputClass} mt-1 font-mono text-xs`} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyHandoff()}>
              <ClipboardCopy className="h-4 w-4" aria-hidden />
              {copied ? 'Copied' : 'Copy summary'}
            </Button>
            {isOwner && value.status !== 'escalated' && (
              <Button type="button" onClick={() => void changeStatus('escalated')}>Mark as escalated</Button>
            )}
          </div>
        </Card>
      )}

      {isOwner && value.status !== 'open' && (
        <Button type="button" variant="ghost" onClick={() => void changeStatus('open')}>Reopen case</Button>
      )}

      {value.sources.length > 0 && (
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
          <ol className="space-y-2">
            {value.sources.map((c) => (
              <li key={c.n} id={`case-${value.id}-source-${c.n}`} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 rounded bg-brand-50 px-1.5 text-xs font-semibold text-brand-700">{c.n}</span>
                <span className="min-w-0">
                  <Link to={`/library/${c.documentId}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {c.title}
                  </Link>
                  <span className="ml-1 text-xs text-slate-500">
                    {[c.section ? `“${c.section}”` : null, c.page ? `page ${c.page}` : null, `version ${c.version}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-400">{value.provider} / {value.model}</p>
        </Card>
      )}
    </div>
  )
}

export function SupportPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [current, setCurrent] = useState<SupportCase | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await listCases()
    if (result.ok) setCases(result.value)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setError(null)
    if (!caseId) return setCurrent(null)
    let active = true
    setLoading(true)
    void getCase(caseId).then((result) => {
      if (!active) return
      setLoading(false)
      if (result.ok) setCurrent(result.value)
      else {
        setCurrent(null)
        setError(result.error)
      }
    })
    return () => {
      active = false
    }
  }, [caseId])

  function handleChange(updated: SupportCase) {
    setCurrent(updated)
    setCases((all) => all.map((c) => (c.id === updated.id ? { ...c, status: updated.status } : c)))
  }

  const caseList = (
    <nav aria-label="Support cases" className="space-y-1">
      {cases.length === 0 && <p className="px-2 text-xs text-slate-500">No cases yet.</p>}
      {cases.map((c) => (
        <Link key={c.id} to={`/support/${c.id}`} aria-current={c.id === caseId ? 'page' : undefined}
          className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${c.id === caseId ? 'bg-brand-50' : 'hover:bg-slate-100'}`}>
          <span className="min-w-0 truncate text-slate-800">{c.title}</span>
          <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      <PageHeader title="Technical Support" description="Describe a problem and get step-by-step diagnostics from your documentation, with sources and escalation guidance." />
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-72 lg:shrink-0">
          <Button type="button" variant="secondary" className="mb-3 w-full" onClick={() => navigate('/support')}>
            <Plus className="h-4 w-4" aria-hidden />
            New case
          </Button>
          <details className="lg:hidden" open={!caseId}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Cases ({cases.length})</summary>
            <div className="mt-2">{caseList}</div>
          </details>
          <div className="hidden lg:block">{caseList}</div>
        </aside>
        <section className="min-w-0 flex-1" aria-label="Support case">
          {error && <Alert tone="error">{error}</Alert>}
          {loading && <Spinner label="Loading case" />}
          {!caseId && (
            <NewCaseForm
              onCreated={(id) => {
                void refresh()
                navigate(`/support/${id}`)
              }}
            />
          )}
          {caseId && current && !loading && <CaseView value={current} onChange={handleChange} />}
        </section>
      </div>
    </>
  )
}
