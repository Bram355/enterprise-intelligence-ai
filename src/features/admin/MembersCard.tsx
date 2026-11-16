import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { updateMember, type Member, type MemberUpdate } from '../../services/members'
import { ROLE_LABELS, type Department, type Role } from '../../types/domain'

const selectClass = 'w-full rounded-lg border-0 py-1 pl-2 pr-8 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 disabled:bg-slate-50'

interface Props {
  members: Member[]
  departments: Department[]
  pendingEmails: Set<string>
  currentUserId: string | undefined
  loading: boolean
  onChanged: () => void
}

export function MembersCard({ members, departments, pendingEmails, currentUserId, loading, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<MemberUpdate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function startEdit(m: Member) {
    setEditing(m.id)
    setDraft({ role: m.role, departmentId: m.departmentId, isActive: m.isActive })
    setError(null)
    setNotice(null)
  }

  async function save(m: Member) {
    if (!draft) return
    setSaving(true)
    const result = await updateMember(m.id, draft)
    setSaving(false)
    if (!result.ok) return setError(result.error)
    setEditing(null)
    setNotice(`${m.fullName || m.email} was updated.`)
    onChanged()
  }

  return (
    <Card title={`Members${loading ? '' : ` (${members.length})`}`}>
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-3 text-sm text-green-700">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Name</th>
                <th scope="col" className="px-5 py-2 font-medium">Role</th>
                <th scope="col" className="px-5 py-2 font-medium">Department</th>
                <th scope="col" className="px-5 py-2 font-medium">Status</th>
                <th scope="col" className="px-5 py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isSelf = m.id === currentUserId
                const isEditing = editing === m.id && draft
                return (
                  <tr key={m.id} className="align-top">
                    <td className="px-5 py-2">
                      <div className="font-medium text-slate-900">
                        {m.fullName || '—'} {isSelf && <span className="text-xs font-normal text-slate-500">(you)</span>}
                      </div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-slate-700">
                      {isEditing ? (
                        <select
                          aria-label={`Role for ${m.email}`}
                          className={selectClass}
                          value={draft.role}
                          disabled={isSelf}
                          onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        ROLE_LABELS[m.role]
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-slate-700">
                      {isEditing ? (
                        <select
                          aria-label={`Department for ${m.email}`}
                          className={selectClass}
                          value={draft.departmentId ?? ''}
                          onChange={(e) => setDraft({ ...draft, departmentId: e.target.value || null })}
                        >
                          <option value="">No department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      ) : (
                        (m.departmentName ?? '—')
                      )}
                    </td>
                    <td className="px-5 py-2">
                      {isEditing ? (
                        <label className="flex items-center gap-2 whitespace-nowrap text-slate-700">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            disabled={isSelf}
                            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                          />
                          Active
                        </label>
                      ) : !m.isActive ? (
                        <Badge tone="neutral">Deactivated</Badge>
                      ) : pendingEmails.has(m.email) ? (
                        <Badge tone="warning">Invited</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                          <Button onClick={() => void save(m)} loading={saving}>Save</Button>
                        </div>
                      ) : (
                        <Button variant="secondary" aria-label={`Edit ${m.email}`} onClick={() => startEdit(m)}>Edit</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing === currentUserId && (
        <p className="mt-3 text-xs text-slate-500">You can't change your own role or deactivate yourself. Ask another admin.</p>
      )}
    </Card>
  )
}
