export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}
