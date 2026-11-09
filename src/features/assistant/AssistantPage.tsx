import { FileText, MessageSquarePlus, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  answerParts,
  askQuestion,
  deleteConversation,
  getConversationMessages,
  listConversations,
  MAX_QUESTION_CHARS,
  submitFeedback,
  type ConversationSummary,
  type FeedbackRating,
  type Message,
} from '../../services/assistant'

function FeedbackBar({ message, onSaved }: { message: Message; onSaved: (m: Message) => void }) {
  const [rating, setRating] = useState<FeedbackRating | null>(message.feedback?.rating ?? null)
  const [comment, setComment] = useState(message.feedback?.comment ?? '')
  const [askComment, setAskComment] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save(next: FeedbackRating, text?: string) {
    setRating(next)
    setState('saving')
    const result = await submitFeedback(message.id, next, text)
    setState(result.ok ? 'saved' : 'error')
    if (result.ok) onSaved({ ...message, feedback: { rating: next, comment: text?.trim() || null } })
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <span>Was this helpful?</span>
        <button
          type="button"
          aria-label="Helpful"
          aria-pressed={rating === 'helpful'}
          onClick={() => {
            setAskComment(false)
            void save('helpful')
          }}
          className={`rounded p-1 hover:bg-slate-100 ${rating === 'helpful' ? 'text-green-700' : ''}`}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          aria-pressed={rating === 'not_helpful'}
          onClick={() => {
            setAskComment(true)
            void save('not_helpful', comment)
          }}
          className={`rounded p-1 hover:bg-slate-100 ${rating === 'not_helpful' ? 'text-red-700' : ''}`}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden />
        </button>
        {state === 'saved' && <span role="status">Thanks for the feedback.</span>}
        {state === 'error' && <span className="text-red-700">Could not save your feedback.</span>}
      </div>
      {askComment && rating === 'not_helpful' && (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void save('not_helpful', comment)
            setAskComment(false)
          }}
        >
          <label htmlFor={`comment-${message.id}`} className="sr-only">
            What was wrong?
          </label>
          <input
            id={`comment-${message.id}`}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was wrong or missing? (optional)"
            className="min-w-0 flex-1 rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
          />
          <Button type="submit" variant="secondary">
            Send
          </Button>
        </form>
      )}
    </div>
  )
}

function MessageView({ message, onFeedback }: { message: Message; onFeedback: (m: Message) => void }) {
  const citationIds = new Set(message.citations.map((c) => c.n))
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-2xl bg-brand-600 px-4 py-2 text-sm text-white">{message.question}</p>
      </div>
      <Card>
        {message.status === 'failed' ? (
          <Alert tone="error">The assistant could not answer this question. Please try again.</Alert>
        ) : message.status === 'no_answer' ? (
          <Alert tone="info">{message.answer}</Alert>
        ) : (
          <>
            {message.status === 'needs_clarification' && <p className="mb-1 text-xs font-medium text-amber-700">The assistant needs more detail</p>}
            <div className="whitespace-pre-line text-sm leading-6 text-slate-800" data-testid="answer">
              {answerParts(message.answer ?? '').map((part, i) =>
                part.cite && citationIds.has(part.cite) ? (
                  <a
                    key={i}
                    href={`#source-${message.id}-${part.cite}`}
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
            {message.status === 'answered' && message.citations.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">No sources were cited for this answer. Check it before relying on it.</p>
            )}
          </>
        )}
        {message.citations.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
            <ol className="space-y-2">
              {message.citations.map((c) => (
                <li key={c.n} id={`source-${message.id}-${c.n}`} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-brand-50 px-1.5 text-xs font-semibold text-brand-700">{c.n}</span>
                    <div className="min-w-0">
                      <Link to={`/library/${c.documentId}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {c.title}
                      </Link>
                      <span className="ml-1 text-xs text-slate-500">
                        {[c.section ? `“${c.section}”` : null, c.page ? `page ${c.page}` : null, `version ${c.version}`].filter(Boolean).join(' · ')}
                      </span>
                      {c.excerpt && <p className="mt-0.5 line-clamp-3 text-xs text-slate-600">{c.excerpt}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {message.status !== 'failed' && (
          <p className="mt-3 text-xs text-slate-400">
            {message.sourcesConsidered !== undefined && `${message.sourcesConsidered} passage${message.sourcesConsidered === 1 ? '' : 's'} considered · `}
            {message.provider} / {message.model}
          </p>
        )}
        {message.status !== 'failed' && <FeedbackBar message={message} onSaved={onFeedback} />}
      </Card>
    </div>
  )
}

export function AssistantPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const loadedFor = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(async () => {
    const result = await listConversations()
    if (result.ok) setConversations(result.value)
  }, [])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    if (conversationId && conversationId === loadedFor.current) return
    setError(null)
    setQuestion('')
    if (!conversationId) {
      if (loadedFor.current !== null) setMessages([])
      loadedFor.current = null
      return
    }
    loadedFor.current = conversationId
    setLoading(true)
    void getConversationMessages(conversationId).then((result) => {
      if (loadedFor.current !== conversationId) return
      setLoading(false)
      if (result.ok) setMessages(result.value)
      else setError(result.error)
    })
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length, pending])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (trimmed.length < 3) return setError('Type a question of at least 3 characters.')
    setError(null)
    setPending(trimmed)
    setQuestion('')
    const result = await askQuestion(trimmed, conversationId)
    setPending(null)
    if (!result.ok) {
      setQuestion(trimmed)
      return setError(result.error)
    }
    const r = result.value
    const message: Message = {
      id: r.queryId ?? crypto.randomUUID(),
      question: trimmed,
      answer: r.answer,
      status: r.status,
      citations: r.citations,
      provider: r.provider,
      model: r.model,
      sourcesConsidered: r.sourcesConsidered,
      feedback: null,
    }
    setMessages((m) => [...m, message])
    if (r.conversationId !== conversationId) {
      loadedFor.current = r.conversationId
      navigate(`/assistant/${r.conversationId}`, { replace: !conversationId })
    }
    void refreshConversations()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this conversation? Your questions stay in the audit log.')) return
    const result = await deleteConversation(id)
    if (!result.ok) return setError(result.error)
    setConversations((c) => c.filter((x) => x.id !== id))
    if (id === conversationId) navigate('/assistant')
  }

  const latest = messages[messages.length - 1]
  const conversationList = (
    <nav aria-label="Conversations" className="space-y-1">
      {conversations.length === 0 && <p className="px-2 text-xs text-slate-500">No conversations yet.</p>}
      {conversations.map((c) => (
        <div key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === conversationId ? 'bg-brand-50' : 'hover:bg-slate-100'}`}>
          <Link to={`/assistant/${c.id}`} className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-slate-800" aria-current={c.id === conversationId ? 'page' : undefined}>
            {c.title}
          </Link>
          <button type="button" onClick={() => void handleDelete(c.id)} aria-label={`Delete conversation ${c.title}`} className="rounded p-1 text-slate-400 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </nav>
  )

  return (
    <>
      <PageHeader title="AI Assistant" description="Ask questions and follow-ups. Answers only use documents you are allowed to see, with numbered sources." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="warning">Development preview</Badge>
        <span className="text-xs text-slate-600">
          {latest && latest.provider !== 'mock'
            ? `Answers are written by ${latest.model} (${latest.provider}) from passages you can access. Check the sources before relying on them.`
            : 'Answers only use passages you can access. In development a free mock may quote passages instead of writing answers.'}
        </span>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <Button type="button" variant="secondary" className="mb-3 w-full" onClick={() => navigate('/assistant')}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            New conversation
          </Button>
          <details className="lg:hidden" open={!conversationId}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Conversations ({conversations.length})</summary>
            <div className="mt-2">{conversationList}</div>
          </details>
          <div className="hidden lg:block">{conversationList}</div>
        </aside>
        <section className="min-w-0 flex-1 space-y-4" aria-label="Conversation">
          {loading && <Spinner label="Loading conversation" />}
          {!loading && messages.length === 0 && !pending && (
            <p className="text-sm text-slate-500">
              Try “What should I check when webhook signatures fail?”, then a follow-up like “and what about duplicate transactions?”
            </p>
          )}
          {messages.map((m) => (
            <MessageView key={m.id} message={m} onFeedback={(updated) => setMessages((all) => all.map((x) => (x.id === updated.id ? updated : x)))} />
          ))}
          {pending && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-line rounded-2xl bg-brand-600 px-4 py-2 text-sm text-white">{pending}</p>
              </div>
              <Card>
                <Spinner label="Searching your documents and writing an answer…" />
              </Card>
            </div>
          )}
          <div ref={bottomRef} />
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3" aria-label="Ask a question" noValidate>
              {error && <Alert tone="error">{error}</Alert>}
              <label htmlFor="question" className="block text-sm font-medium text-slate-700">
                {conversationId ? 'Ask a follow-up' : 'Your question'}
              </label>
              <textarea
                id="question"
                rows={2}
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
                <span className="text-xs text-slate-500">Enter to send, Shift+Enter for a new line.</span>
                <Button type="submit" loading={pending !== null}>
                  <Send className="h-4 w-4" aria-hidden />
                  Ask
                </Button>
              </div>
            </form>
          </Card>
        </section>
      </div>
    </>
  )
}
