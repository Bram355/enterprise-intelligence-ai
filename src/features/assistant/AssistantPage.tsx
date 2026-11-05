import { FileText, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { answerParts, askQuestion, MAX_QUESTION_CHARS, type AskResult } from '../../services/assistant'

interface Exchange {
  id: number
  question: string
  result: AskResult
}

function AnswerCard({ exchange }: { exchange: Exchange }) {
  const { question, result } = exchange
  const citationIds = new Set(result.citations.map((c) => c.n))
  return (
    <Card>
      <p className="mb-3 text-sm font-medium text-slate-900">{question}</p>
      {result.status === 'no_answer' ? (
        <Alert tone="info">{result.answer}</Alert>
      ) : (
        <div className="whitespace-pre-line text-sm leading-6 text-slate-800" data-testid="answer">
          {answerParts(result.answer).map((part, i) =>
            part.cite && citationIds.has(part.cite) ? (
              <a
                key={i}
                href={`#source-${exchange.id}-${part.cite}`}
                className="mx-0.5 rounded bg-brand-50 px-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                aria-label={`Source ${part.cite}`}
              >
                {part.cite}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </div>
      )}
      {result.status === 'answered' && result.citations.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">No sources were cited for this answer. Check it before relying on it.</p>
      )}
      {result.citations.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
          <ol className="space-y-2">
            {result.citations.map((c) => (
              <li key={c.n} id={`source-${exchange.id}-${c.n}`} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 rounded bg-brand-50 px-1.5 text-xs font-semibold text-brand-700">{c.n}</span>
                  <div className="min-w-0">
                    <Link to={`/library/${c.documentId}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {c.title}
                    </Link>
                    <span className="ml-1 text-xs text-slate-500">
                      {[c.page ? `page ${c.page}` : null, `version ${c.version}`].filter(Boolean).join(' · ')}
                    </span>
                    <p className="mt-0.5 line-clamp-3 text-xs text-slate-600">{c.excerpt}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        {result.sourcesConsidered} passage{result.sourcesConsidered === 1 ? '' : 's'} considered · {result.provider} / {result.model}
      </p>
    </Card>
  )
}

export function AssistantPage() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Exchange[]>([])
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (trimmed.length < 3) return setError('Type a question of at least 3 characters.')
    setError(null)
    setAsking(true)
    const result = await askQuestion(trimmed)
    setAsking(false)
    if (!result.ok) return setError(result.error)
    setHistory((h) => [{ id: Date.now(), question: trimmed, result: result.value }, ...h])
    setQuestion('')
  }

  const latest = history[0]?.result
  const usingMock = latest?.provider === 'mock'

  return (
    <>
      <PageHeader title="AI Assistant" description="Ask a question. Answers only use documents you are allowed to see, with numbered sources." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="warning">Development preview</Badge>
        <span className="text-xs text-slate-600">
          {latest && latest.provider !== 'mock'
            ? `Answers are written by ${latest.model} (${latest.provider}) from passages you can access. Check the sources before relying on them.`
            : 'Answers only use passages you can access. In development a free mock may quote passages instead of writing answers.'}{' '}
          Conversations and feedback come in Phase 5.
        </span>
      </div>
      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="space-y-3" aria-label="Ask a question" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <label htmlFor="question" className="block text-sm font-medium text-slate-700">
            Your question
          </label>
          <textarea
            id="question"
            rows={3}
            maxLength={MAX_QUESTION_CHARS}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="e.g. How do I fix a webhook signature error?"
            className="block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Press Enter to ask, Shift+Enter for a new line.</span>
            <Button type="submit" loading={asking}>
              <Send className="h-4 w-4" aria-hidden />
              {asking ? 'Searching…' : 'Ask'}
            </Button>
          </div>
        </form>
      </Card>
      {history.length === 0 ? (
        <p className="text-sm text-slate-500">Try “What should I check when webhook signatures fail?” or “How long do customers have to request a refund?”</p>
      ) : (
        <div className="space-y-4">
          {usingMock && <p className="text-xs text-slate-500">Answers below are passages quoted by the mock, not AI-written text.</p>}
          {history.map((exchange) => (
            <AnswerCard key={exchange.id} exchange={exchange} />
          ))}
        </div>
      )}
    </>
  )
}
