import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { passwordProblems } from '../../lib/password'
import { updateOwnName, updatePassword } from '../../services/auth'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './auth-context'

interface SetPasswordPageProps {
  mode: 'invite' | 'reset'
}

export function SetPasswordPage({ mode }: SetPasswordPageProps) {
  const { status, session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const title = mode === 'invite' ? 'Welcome — set up your account' : 'Choose a new password'

  if (status === 'loading') return <FullPageSpinner />
  if (!session) {
    return (
      <AuthLayout
        title={mode === 'invite' ? 'Invitation link not valid' : 'Reset link not valid'}
        description="This link has expired or was already used. Ask your administrator for a new invitation, or request a new reset link."
      >
        <Link to={mode === 'invite' ? '/login' : '/forgot-password'} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {mode === 'invite' ? 'Go to sign in' : 'Request a new link'}
        </Link>
      </AuthLayout>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const problems = passwordProblems(password)
    if (problems.length) {
      setError(`Password needs ${problems.join(', ')}.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await updatePassword(password)
    if (result.ok && mode === 'invite' && fullName.trim() && session) {
      await updateOwnName(session.user.id, fullName)
      await refreshProfile()
    }
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title={title}
      description={
        mode === 'invite' && profile
          ? `You've been invited to ${profile.organisationName}. Choose a password to finish.`
          : `Signed in as ${session.user.email}.`
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {mode === 'invite' && (
          <TextField
            label="Full name"
            autoComplete="name"
            defaultValue={profile?.fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
          />
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 10 characters, with upper- and lowercase letters and a number."
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          {mode === 'invite' ? 'Create account' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
