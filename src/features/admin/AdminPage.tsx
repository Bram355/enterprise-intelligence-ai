import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'
import { listDepartments, listInvitations, listMembers, type Member } from '../../services/members'
import { ROLE_LABELS, type Department, type Invitation, type InvitationStatus } from '../../types/domain'
import { InviteMemberForm } from './InviteMemberForm'

const STATUS_TONE: Record<InvitationStatus, BadgeTone> = { pending: 'warning', accepted: 'success', revoked: 'neutral' }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function AdminPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listMembers(), listDepartments(), listInvitations()])
      .then(([m, d, i]) => {
        if (!active) return
        setMembers(m)
        setDepartments(d)
        setInvitations(i)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load administration data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [version])

  return (
    <>
      <PageHeader title="Administration" description="Invite people and review who has access to your organisation." />
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Invite a member" className="self-start">
          <InviteMemberForm departments={departments} onInvited={() => setVersion((v) => v + 1)} />
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Members${loading ? '' : ` (${members.length})`}`}>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="px-5 py-2">
                          <div className="font-medium text-slate-900">{m.fullName || '—'}</div>
                          <div className="text-xs text-slate-500">{m.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-slate-700">{ROLE_LABELS[m.role]}</td>
                        <td className="whitespace-nowrap px-5 py-2 text-slate-700">{m.departmentName ?? '—'}</td>
                        <td className="px-5 py-2">
                          <Badge tone={m.isActive ? 'success' : 'neutral'}>{m.isActive ? 'Active' : 'Deactivated'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Invitations">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-slate-500">No invitations yet.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2 font-medium">Email</th>
                      <th scope="col" className="px-5 py-2 font-medium">Role</th>
                      <th scope="col" className="px-5 py-2 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitations.map((i) => (
                      <tr key={i.id}>
                        <td className="break-all px-5 py-2 text-slate-900">{i.email}</td>
                        <td className="whitespace-nowrap px-5 py-2 text-slate-700">{ROLE_LABELS[i.role]}</td>
                        <td className="px-5 py-2">
                          <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-slate-700">{formatDate(i.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <PlannedFeature
            phase={7}
            summary="Further administration tools arrive in Phase 7."
            capabilities={['Change roles and departments', 'Deactivate members', 'Resend or revoke invitations', 'Manage departments', 'Audit log viewer', 'Feedback review']}
          />
        </div>
      </div>
    </>
  )
}
