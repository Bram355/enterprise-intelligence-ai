import { Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SelectField, TextField } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { can } from '../../lib/permissions'
import {
  createCategory,
  listCategories,
  listDocuments,
  searchDocuments,
  snippetParts,
  type Category,
  type DocumentSummary,
  type SearchResult,
} from '../../services/documents'
import { useAuth } from '../auth/auth-context'
import { StatusBadge } from './StatusBadge'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function SearchResults({ results }: { results: SearchResult[] }) {
  if (results.length === 0) return <p className="text-sm text-slate-500">No documents match your search.</p>
  return (
    <ul className="divide-y divide-slate-100">
      {results.map((r) => (
        <li key={r.documentId} className="py-3">
          <Link to={`/library/${r.documentId}`} className="font-medium text-brand-700 hover:underline">
            {r.title}
          </Link>
          <span className="ml-2 text-xs text-slate-500">
            {[r.categoryName, r.page ? `page ${r.page}` : null].filter(Boolean).join(' · ')}
          </span>
          <p className="mt-1 text-sm text-slate-600">
            {snippetParts(r.snippet).map((part, i) =>
              part.highlight ? (
                <mark key={i} className="rounded bg-amber-100 px-0.5 text-slate-900">
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

function CategoriesCard({ categories, organisationId, onCreated }: { categories: Category[]; organisationId: string; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 80) return setFeedback({ tone: 'error', text: 'Enter a name of up to 80 characters.' })
    setSaving(true)
    const result = await createCategory(organisationId, name)
    setSaving(false)
    if (!result.ok) return setFeedback({ tone: 'error', text: result.error })
    setFeedback({ tone: 'success', text: `Added “${name.trim()}”.` })
    setName('')
    onCreated()
  }

  return (
    <Card title="Categories" className="min-w-0 self-start">
      <ul className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <li key={c.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
            {c.name}
          </li>
        ))}
        {categories.length === 0 && <li className="text-sm text-slate-500">No categories yet.</li>}
      </ul>
      <form className="space-y-3" onSubmit={handleSubmit} noValidate aria-label="Add a category">
        {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
        <TextField label="New category" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Button type="submit" variant="secondary" loading={saving}>
          Add category
        </Button>
      </form>
    </Card>
  )
}

export function LibraryPage() {
  const { profile } = useAuth()
  const canManage = can(profile?.role, 'documents.manage')
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listDocuments(), listCategories()])
      .then(([d, c]) => {
        if (!active) return
        setDocuments(d)
        setCategories(c)
        setError(null)
      })
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Could not load documents.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [version])

  const visible = useMemo(
    () =>
      documents.filter((d) => {
        if (categoryFilter && d.categoryId !== categoryFilter) return false
        if (statusFilter === 'active') return !d.archivedAt
        if (statusFilter === 'archived') return Boolean(d.archivedAt)
        if (statusFilter === 'failed') return d.status === 'failed' && !d.archivedAt
        return true
      }),
    [documents, categoryFilter, statusFilter],
  )

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return setResults(null)
    setSearching(true)
    try {
      setResults(await searchDocuments(query))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <PageHeader title="Knowledge Library" description="Approved organisational documents. You only see documents you are allowed to access." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form className="flex w-full max-w-xl items-end gap-2" onSubmit={handleSearch} role="search">
          <div className="flex-1">
            <TextField label="Search document contents" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. webhook signature" />
          </div>
          <Button type="submit" variant="secondary" loading={searching} aria-label="Search">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        {canManage && (
          <Link
            to="/library/upload"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload document
          </Link>
        )}
      </div>
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-6 ${canManage ? 'lg:grid-cols-3' : ''}`}>
        <div className={`min-w-0 space-y-6 ${canManage ? 'lg:col-span-2' : ''}`}>
          {results && (
            <Card title={`Search results for “${query.trim()}”`}>
              <SearchResults results={results} />
              <button type="button" className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700" onClick={() => setResults(null)}>
                Clear search
              </button>
            </Card>
          )}
          <Card title={`Documents${loading ? '' : ` (${visible.length})`}`}>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              {canManage && (
                <SelectField label="Show" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="active">Active documents</option>
                  <option value="failed">Failed processing</option>
                  <option value="archived">Archived</option>
                  <option value="all">Everything</option>
                </SelectField>
              )}
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-slate-500">
                {documents.length === 0 ? 'No documents yet.' : 'No documents match these filters.'}
                {documents.length === 0 && canManage && ' Upload the first one to get started.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link to={`/library/${d.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {d.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {[d.categoryName, d.visibility === 'departments' ? `Restricted: ${d.departments.map((x) => x.name).join(', ')}` : 'Everyone', `v${d.currentVersion || 1}`, `Updated ${formatDate(d.updatedAt)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <StatusBadge status={d.status} archived={Boolean(d.archivedAt)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {canManage && profile && (
          <CategoriesCard categories={categories} organisationId={profile.organisationId} onCreated={() => setVersion((v) => v + 1)} />
        )}
      </div>
    </>
  )
}
