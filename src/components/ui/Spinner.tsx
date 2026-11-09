export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden />
      {label}
    </div>
  )
}
