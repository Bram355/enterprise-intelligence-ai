import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const CONTROL =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500'

interface FieldWrapperProps {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, className = '', ...rest }: TextFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${CONTROL} ${invalid ? 'ring-red-400' : ''} ${className}`}
          {...rest}
        />
      )}
    </FieldWrapper>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

export function SelectField({ label, hint, error, className = '', children, ...rest }: SelectFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${CONTROL} ${className}`}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldWrapper>
  )
}
