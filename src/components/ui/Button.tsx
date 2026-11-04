import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
}
