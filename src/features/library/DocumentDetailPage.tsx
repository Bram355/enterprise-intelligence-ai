import { ArrowLeft, Download } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { can } from '../../lib/permissions'
import {
  ACCEPTED_FILE_TYPES,
  checkFile,
  downloadVersion,
  formatBytes,
  getDocument,
  listCategories,
  parseTags,
  setArchived,
  updateDocument,
  uploadDocument,
  type Category,
  type DocumentDetail,
} from '../../services/documents'
import { listDepartments } from '../../services/members'
import type { Department } from '../../types/domain'
import { useAuth } from '../auth/auth-context'
import { DocumentFormFields, type DocumentFormValues } from './DocumentForm'
import { StatusBadge } from './StatusBadge'

type Feedback = { tone: 'success' | 'error'; text: string } | null

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function toFormValues(doc: DocumentDetail): DocumentFormValues {
  return {
    title: doc.title,
    description: doc.description,
    categoryId: doc.categoryId ?? '',
    tags: doc.tags.join(', '),
    visibility: doc.visibility,
    departmentIds: doc.departments.map((d) => d.id),
  }
}

export function DocumentDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { profile } = useAuth()
  const canManage = can(profile?.role, 'documents.manage')
  const [doc, setDoc] = useState<DocumentDetail | null | undefined>(undefined)
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [reload, setReload] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(
    (location.state as { justUploaded?: boolean } | null)?.justUploaded ? { tone: 'success', text: 'Document uploaded.' } : null,
  )
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<DocumentFormValues | null>(null)
  const [busy, setBusy] = useState<'save' | 'archive' | 'version' | null>(null)
  const [newFile, setNewFile] = useState<File | null>(null)

  useEffect(() => {
    let active = true
    getDocument(id)
      .then((d) => active && setDoc(d))
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : 'Could not load the document.'))
    return () => {
      active = false
    }
  }, [id, reload])

  useEffect(() => {
    if (!canManage) return
    Promise.all([listCategories(), listDepartments()])
      .then(([c, d]) => {
        setCategories(c)
        setDepartments(d)
      })
      .catch(() => setFeedback({ tone: 'error', text: 'Could not load categories and departments.' }))
  }, [canManage])

  if (loadError) return <Alert tone="error">{loadError}</Alert>
  if (doc === undefined) return <p className="text-sm text-slate-500">Loading…</p>
  if (doc === null) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Document not found</h1>
        <p className="mt-1 text-sm text-slate-600">It may have been removed, or you may not have access to it.</p>
        <Link to="/library" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to the Knowledge Library
        </Link>
      </div>
    )
  }
  const current = doc

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!values || !profile) return
    if (!values.title.trim()) return setFeedback({ tone: 'error', text: 'Enter a title.' })
    if (values.visibility === 'departments' && values.departmentIds.length === 0) {
      return setFeedback({ tone: 'error', text: 'Choose at least one department.' })
    }
    setBusy('save')
    const result = await updateDocument(current, profile.organisationId, {
      title: values.title,
      description: values.description,
      categoryId: values.categoryId || null,
      tags: parseTags(values.tags),
      visibility: values.visibility,
      departmentIds: values.departmentIds,
    })
    setBusy(null)
    if (!result.ok) return setFeedback({ tone: 'error', text: result.error })
    setFeedback({ tone: 'success', text: 'Details saved.' })
    setEditing(false)
    setReload((r) => r + 1)
  }

  async function handleArchive() {
    setBusy('archive')
    const result = await setArchived(current.id, !current.archivedAt)
    setBusy(null)
    if (!result.ok) return setFeedback({ tone: 'error', text: result.error })
    setFeedback({ tone: 'success', text: current.archivedAt ? 'Document restored.' : 'Document archived. Employees can no longer see it.' })
    setReload((r) => r + 1)
  }

  async function handleNewVersion(event: FormEvent) {
    event.preventDefault()
    const problem = checkFile(newFile)
    if (problem || !newFile) return setFeedback({ tone: 'error', text: problem ?? 'Choose a file.' })
    setBusy('version')
    const result = await uploadDocument({ file: newFile, documentId: current.id })
    setBusy(null)
    if (!result.ok) return setFeedback({ tone: 'error', text: result.error })
    setFeedback(
      result.value.status === 'indexed'
        ? { tone: 'success', text: `Version ${result.value.version} uploaded and indexed.` }
        : { tone: 'error', text: `Version ${result.value.version} could not be processed: ${result.value.error ?? 'unknown error'}` },
    )
    setNewFile(null)
    setReload((r) => r + 1)
  }

  async function handleDownload(versionIndex: number) {
    const result = await downloadVersion(current.versions[versionIndex])
    if (!result.ok) setFeedback({ tone: 'error', text: result.error })
  }

  return (
    <>
      <Link to="/library" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Knowledge Library
      </Link>
      <PageHeader title={doc.title} description={doc.description || undefined} />
      {feedback && (
        <div className="mb-4">
          <Alert tone={feedback.tone}>{feedback.text}</Alert>
        </div>
      )}
      {doc.processingError && (
        <div className="mb-4">
          <Alert tone="error">{doc.processingError}</Alert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {editing && values ? (
            <Card title="Edit details">
              <form className="space-y-4" onSubmit={handleSave} noValidate aria-label="Edit document details">
                <DocumentFormFields values={values} onChange={setValues} categories={categories} departments={departments} />
                <div className="flex gap-2">
                  <Button type="submit" loading={busy === 'save'}>
                    Save details
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card title="Details">
              <dl className="grid grid-cols-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Status</dt>
                <dd className="col-span-2">
                  <StatusBadge status={doc.status} archived={Boolean(doc.archivedAt)} />
                </dd>
                <dt className="text-slate-500">Category</dt>
                <dd className="col-span-2 text-slate-900">{doc.categoryName ?? 'None'}</dd>
                <dt className="text-slate-500">Visible to</dt>
                <dd className="col-span-2 text-slate-900">
                  {doc.visibility === 'organisation' ? 'Everyone in the organisation' : doc.departments.map((d) => d.name).join(', ')}
                </dd>
                <dt className="text-slate-500">Tags</dt>
                <dd className="col-span-2 flex flex-wrap gap-1">
                  {doc.tags.length === 0 && <span className="text-slate-500">None</span>}
                  {doc.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {t}
                    </span>
                  ))}
                </dd>
                <dt className="text-slate-500">Current version</dt>
                <dd className="col-span-2 text-slate-900">{doc.currentVersion || '—'}</dd>
              </dl>
              {canManage && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setValues(toFormValues(doc))
                      setEditing(true)
                    }}
                  >
                    Edit details
                  </Button>
                  <Button variant="secondary" loading={busy === 'archive'} onClick={() => void handleArchive()}>
                    {doc.archivedAt ? 'Restore' : 'Archive'}
                  </Button>
                </div>
              )}
            </Card>
          )}
          <Card title="Extracted text preview">
            {doc.preview.length === 0 ? (
              <p className="text-sm text-slate-500">No text has been extracted yet.</p>
            ) : (
              <div className="space-y-3">
                {doc.preview.map((chunk, i) => (
                  <blockquote key={i} className="whitespace-pre-line border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                    {chunk.page && <span className="mb-1 block text-xs font-medium text-slate-500">Page {chunk.page}</span>}
                    {chunk.content}
                  </blockquote>
                ))}
                <p className="text-xs text-slate-500">Showing the first passages. The full text is indexed for search.</p>
              </div>
            )}
          </Card>
        </div>
        <div className="min-w-0 space-y-6">
          <Card title="Versions">
            <ul className="divide-y divide-slate-100">
              {doc.versions.map((v, i) => (
                <li key={v.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">Version {v.version}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="break-all text-xs text-slate-500">
                    {v.fileName} · {formatBytes(v.sizeBytes)}
                    {v.chunkCount ? ` · ${v.chunkCount} passages` : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(v.createdAt)}
                    {v.uploadedBy ? ` · ${v.uploadedBy}` : ''}
                  </div>
                  {v.error && <div className="mt-1 text-xs text-red-600">{v.error}</div>}
                  <button
                    type="button"
                    onClick={() => void handleDownload(i)}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden /> Download
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {canManage && !doc.archivedAt && (
            <Card title="Upload a new version">
              <form className="space-y-3" onSubmit={handleNewVersion} noValidate aria-label="Upload a new version">
                <input
                  type="file"
                  aria-label="New version file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
                />
                <p className="text-xs text-slate-500">Older versions are kept. Search uses the newest indexed version.</p>
                <Button type="submit" variant="secondary" loading={busy === 'version'}>
                  Upload version
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
