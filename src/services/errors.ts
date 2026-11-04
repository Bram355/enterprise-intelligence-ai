import { FunctionsHttpError, type AuthError } from '@supabase/supabase-js'

export function authErrorMessage(error: AuthError | Error): string {
  const status = 'status' in error ? error.status : undefined
  const code = 'code' in error ? error.code : undefined
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return 'Email or password is incorrect.'
  }
  if (code === 'weak_password') return 'That password is too weak. Use at least 10 characters with upper- and lowercase letters and a number.'
  if (code === 'same_password') return 'Choose a password different from your current one.'
  if (/fetch|network/i.test(error.message)) return 'Cannot reach the server. Check your connection and try again.'
  return 'Something went wrong. Please try again.'
}

export async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: unknown }
      if (typeof body.error === 'string') return body.error
    } catch {
      // fall through
    }
  }
  return 'Something went wrong. Please try again.'
}
