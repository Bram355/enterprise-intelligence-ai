import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { listDepartments, listInvitations, listMembers, revokeInvitation, type Member } from '../../services/members'
import { ROLE_LABELS, type Department, type Invitation, type InvitationStatus } from '../../types/domain'
import { useAuth } from '../auth/auth-context'
import { AuditLogCard } from './AuditLogCard'
import { DepartmentsCard } from './DepartmentsCard'
import { InviteMemberForm } from './InviteMemberForm'
import { MembersCard } from './MembersCard'

const STATUS_TONE: Record<InvitationStatus, BadgeTone> = { pending: 'warning', accepted: 'success', revoked: 'neutral' }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function AdminPage() {
  const { profile } = useAuth()
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

  const pendingEmails = new Set(invitations.filter((i) => i.status === 'pending').map((i) => i.email))
  const refresh = () => setVersion((v) => v + 1)

  async function revoke(invitation: Invitation) {
    if (!window.confirm(`Cancel the invitation for ${invitation.email}? Their sign-up link will stop working.`)) return
    const result = await revokeInvitation(invitation.id)
    if (!result.ok) return setError(result.error)
    refresh()
  }

  return (
    <>
      <PageHeader title="Administration" description="Manage who has access to your organisation, and review what happened." />
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 self-start">
          <Card title="Invite a member" className="min-w-0">
            <InviteMemberForm departments={departments} onInvited={refresh} />
          </Card>
          <DepartmentsCard departments={departments} members={members} organisationId={profile?.organisationId} onChanged={refresh} />
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <MembersCard
            members={members}
            departments={departments}
            pendingEmails={pendingEmails}
            currentUserId={profile?.id}
            loading={loading}
            onChanged={refresh}
          />
          <Card title="Invitations">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-slate-500">No invitations yet.</p>
            ) : (
              <div className="relative -mx-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2 font-medium">Email</th>
                      <th scope="col" className="px-5 py-2 font-medium">Role</th>
                      <th scope="col" className="px-5 py-2 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2 font-medium">Sent</th>
                      <th scope="col" className="px-5 py-2 font-medium"><span className="sr-only">Actions</span></th>
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
                        <td className="whitespace-nowrap px-5 py-2 text-right">
                          {i.status === 'pending' && (
                            <button
                              type="button"
                              aria-label={`Cancel invitation for ${i.email}`}
                              className="text-xs text-red-700 hover:underline"
                              onClick={() => void revoke(i)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <AuditLogCard refreshKey={version} />
        </div>
      </div>
    </>
  )
}
