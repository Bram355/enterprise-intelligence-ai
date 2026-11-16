import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { deleteDepartment, saveDepartment, type Member } from '../../services/members'
import type { Department } from '../../types/domain'

const inputClass = 'min-w-0 flex-1 rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600'

interface Props {
  departments: Department[]
  members: Member[]
  organisationId: string | undefined
  onChanged: () => void
}

export function DepartmentsCard({ departments, members, organisationId, onChanged }: Props) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const memberCount = (id: string) => members.filter((m) => m.departmentId === id).length

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onDone?: () => void) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setError(null)
    onDone?.()
    onChanged()
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!organisationId) return
    void run(() => saveDepartment(newName, organisationId), () => setNewName(''))
  }

  function remove(d: Department) {
    const count = memberCount(d.id)
    const warning = count ? ` ${count} member(s) will be left without a department.` : ''
    if (!window.confirm(`Delete the ${d.name} department?${warning}`)) return
    void run(() => deleteDepartment(d.id))
  }

  return (
    <Card title="Departments" className="min-w-0 self-start">
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <ul className="mb-3 divide-y divide-slate-100 text-sm">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center gap-2 py-2">
            {renaming === d.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!organisationId) return
                  void run(() => saveDepartment(renameValue, organisationId, d.id), () => setRenaming(null))
                }}
              >
                <label htmlFor={`rename-${d.id}`} className="sr-only">New name for {d.name}</label>
                <input id={`rename-${d.id}`} className={inputClass} value={renameValue} maxLength={80} onChange={(e) => setRenameValue(e.target.value)} />
                <Button type="submit" loading={busy}>Save</Button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-slate-800">
                  {d.name} <span className="text-xs text-slate-500">· {memberCount(d.id)} members</span>
                </span>
                <button
                  type="button"
                  aria-label={`Rename ${d.name}`}
                  className="text-xs text-brand-700 hover:underline"
                  onClick={() => {
                    setRenaming(d.id)
                    setRenameValue(d.name)
                  }}
                >
                  Rename
                </button>
                <button type="button" aria-label={`Delete ${d.name}`} className="text-xs text-red-700 hover:underline" onClick={() => remove(d)}>
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
        {departments.length === 0 && <li className="py-2 text-slate-500">No departments yet.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={add}>
        <label htmlFor="new-department" className="sr-only">New department name</label>
        <input id="new-department" className={inputClass} value={newName} maxLength={80} placeholder="New department" onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" variant="secondary" loading={busy} disabled={!newName.trim()}>Add</Button>
      </form>
    </Card>
  )
}
