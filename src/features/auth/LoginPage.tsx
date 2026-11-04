import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { signIn } from '../../services/auth'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'signed_in') return <Navigate to={from} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout title="Sign in" description="Access is by invitation from your organisation administrator.">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
