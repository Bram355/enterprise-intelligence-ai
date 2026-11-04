import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TextField } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { passwordProblems } from '../../lib/password'
import { updateOwnName, updatePassword } from '../../services/auth'
import { ROLE_LABELS } from '../../types/domain'
import { useAuth } from '../auth/auth-context'

type Feedback = { tone: 'success' | 'error'; text: string } | null

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null)
  const [savingName, setSavingName] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  if (!profile) return null

  async function saveName(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    if (fullName.trim().length > 120) {
      setNameFeedback({ tone: 'error', text: 'Name must be 120 characters or fewer.' })
      return
    }
    setSavingName(true)
    const result = await updateOwnName(profile.id, fullName)
    setSavingName(false)
    if (result.ok) {
      await refreshProfile()
      setNameFeedback({ tone: 'success', text: 'Name saved.' })
    } else setNameFeedback({ tone: 'error', text: result.error })
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    const problems = passwordProblems(password)
    if (problems.length) {
      setPasswordFeedback({ tone: 'error', text: `Password needs ${problems.join(', ')}.` })
      return
    }
    if (password !== confirm) {
      setPasswordFeedback({ tone: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    const result = await updatePassword(password)
    setSavingPassword(false)
    if (result.ok) {
      setPassword('')
      setConfirm('')
      setPasswordFeedback({ tone: 'success', text: 'Password updated.' })
    } else setPasswordFeedback({ tone: 'error', text: result.error })
  }

  return (
    <>
      <PageHeader title="Your profile" description="Your account details and sign-in settings." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Email</dt>
            <dd className="col-span-2 break-all text-slate-900">{profile.email}</dd>
            <dt className="text-slate-500">Organisation</dt>
            <dd className="col-span-2 text-slate-900">{profile.organisationName}</dd>
            <dt className="text-slate-500">Role</dt>
            <dd className="col-span-2 text-slate-900">{ROLE_LABELS[profile.role]}</dd>
            <dt className="text-slate-500">Department</dt>
            <dd className="col-span-2 text-slate-900">{profile.departmentName ?? 'None'}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Role and department are managed by your organisation administrator.</p>
          <form className="mt-5 space-y-3 border-t border-slate-100 pt-4" onSubmit={saveName} noValidate>
            {nameFeedback && <Alert tone={nameFeedback.tone}>{nameFeedback.text}</Alert>}
            <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoComplete="name" />
            <Button type="submit" variant="secondary" loading={savingName}>
              Save name
            </Button>
          </form>
        </Card>
        <Card title="Change password" className="self-start">
          <form className="space-y-3" onSubmit={savePassword} noValidate>
            {passwordFeedback && <Alert tone={passwordFeedback.tone}>{passwordFeedback.text}</Alert>}
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="At least 10 characters, with upper- and lowercase letters and a number."
            />
            <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="submit" variant="secondary" loading={savingPassword}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}
