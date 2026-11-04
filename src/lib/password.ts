// Mirrors the server policy in supabase/config.toml ([auth] minimum_password_length / password_requirements).
export const PASSWORD_MIN_LENGTH = 10

export function passwordProblems(password: string): string[] {
  const problems: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`at least ${PASSWORD_MIN_LENGTH} characters`)
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter')
  if (!/[0-9]/.test(password)) problems.push('a number')
  return problems
}
