import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { checkFile, listCategories, parseTags, uploadDocument, type Category, ACCEPTED_FILE_TYPES } from '../../services/documents'
import { listDepartments } from '../../services/members'
import type { Department } from '../../types/domain'
import { DocumentFormFields, type DocumentFormValues } from './DocumentForm'

const EMPTY: DocumentFormValues = { title: '', description: '', categoryId: '', tags: '', visibility: 'organisation', departmentIds: [] }

export function UploadDocumentPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [values, setValues] = useState<DocumentFormValues>(EMPTY)
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listCategories(), listDepartments()])
      .then(([c, d]) => {
        setCategories(c)
        setDepartments(d)
      })
      .catch(() => setError('Could not load categories and departments.'))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const fileProblem = checkFile(file)
    if (fileProblem || !file) return setError(fileProblem)
    if (values.visibility === 'departments' && values.departmentIds.length === 0) return setError('Choose at least one department.')
    setSubmitting(true)
    const result = await uploadDocument({
      file,
      title: values.title,
      description: values.description,
      categoryId: values.categoryId || null,
      tags: parseTags(values.tags),
      visibility: values.visibility,
      departmentIds: values.departmentIds,
    })
    setSubmitting(false)
    if (!result.ok) return setError(result.error)
    navigate(`/library/${result.value.documentId}`, { state: { justUploaded: true } })
  }

  return (
    <>
      <PageHeader title="Upload a document" description="PDF, Word (.docx), text or Markdown, up to 20 MB. Use synthetic data only in this development build." />
      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-label="Upload a document">
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <label htmlFor="doc-file" className="mb-1 block text-sm font-medium text-slate-700">
              File
            </label>
            <input
              id="doc-file"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
          <DocumentFormFields
            values={values}
            onChange={setValues}
            categories={categories}
            departments={departments}
            titlePlaceholder={file ? file.name.replace(/\.[^.]+$/, '') : 'Defaults to the file name'}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              {submitting ? 'Uploading and processing…' : 'Upload'}
            </Button>
            <Link to="/library" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </>
  )
}
