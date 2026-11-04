import { SelectField, TextField } from '../../components/ui/Field'
import type { Department } from '../../types/domain'
import type { Category, Visibility } from '../../services/documents'

export interface DocumentFormValues {
  title: string
  description: string
  categoryId: string
  tags: string
  visibility: Visibility
  departmentIds: string[]
}

interface DocumentFormFieldsProps {
  values: DocumentFormValues
  onChange: (values: DocumentFormValues) => void
  categories: Category[]
  departments: Department[]
  titlePlaceholder?: string
}

export function DocumentFormFields({ values, onChange, categories, departments, titlePlaceholder }: DocumentFormFieldsProps) {
  const set = <K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) => onChange({ ...values, [key]: value })
  const toggleDepartment = (id: string) =>
    set('departmentIds', values.departmentIds.includes(id) ? values.departmentIds.filter((d) => d !== id) : [...values.departmentIds, id])

  return (
    <>
      <TextField label="Title" value={values.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder={titlePlaceholder} />
      <div>
        <label htmlFor="doc-description" className="mb-1 block text-sm font-medium text-slate-700">
          Description (optional)
        </label>
        <textarea
          id="doc-description"
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          className="block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600"
        />
      </div>
      <SelectField label="Category" value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Tags (optional)"
        value={values.tags}
        onChange={(e) => set('tags', e.target.value)}
        hint="Separate tags with commas, e.g. api, errors, webhooks"
      />
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">Who can see this document</legend>
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" checked={values.visibility === 'organisation'} onChange={() => set('visibility', 'organisation')} />
            Everyone in the organisation
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" checked={values.visibility === 'departments'} onChange={() => set('visibility', 'departments')} />
            Only selected departments
          </label>
        </div>
        {values.visibility === 'departments' && (
          <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg border border-slate-200 p-3 text-sm sm:grid-cols-2">
            {departments.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={values.departmentIds.includes(d.id)} onChange={() => toggleDepartment(d.id)} />
                {d.name}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500">Admins and knowledge managers can always see every document.</p>
      </fieldset>
    </>
  )
}
