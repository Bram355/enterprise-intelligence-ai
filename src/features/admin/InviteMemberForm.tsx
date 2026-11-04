import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/Field'
import { inviteMember } from '../../services/members'
import { ROLE_LABELS, ROLES, type Department, type Role } from '../../types/domain'

interface InviteMemberFormProps {
  departments: Department[]
  onInvited: () => void
}

export function InviteMemberForm({ departments, onInvited }: InviteMemberFormProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [departmentId, setDepartmentId] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFeedback(null)
    const trimmed = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setFeedback({ tone: 'error', text: 'Enter a valid email address.' })
      return
    }
    setSubmitting(true)
    const result = await inviteMember({ email: trimmed, fullName, role, departmentId: departmentId || null })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', text: result.error })
      return
    }
    setFeedback({ tone: 'success', text: `Invitation sent to ${trimmed}.` })
    setEmail('')
    setFullName('')
    setRole('employee')
    setDepartmentId('')
    onInvited()
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit} noValidate aria-label="Invite a member">
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <TextField label="Full name (optional)" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
      <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
        <option value="">No department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
      <Button type="submit" loading={submitting}>
        Send invitation
      </Button>
    </form>
  )
}
