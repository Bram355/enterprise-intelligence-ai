import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { sendPasswordReset } from '../../services/auth'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    const result = await sendPasswordReset(email)
    setSubmitting(false)
    if (!result.ok) setError(result.error)
    else setSent(true)
  }

  return (
    <AuthLayout title="Reset your password" description="We'll email you a link to choose a new password.">
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success">If an account exists for {email.trim()}, a reset link is on its way.</Alert>
          <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
