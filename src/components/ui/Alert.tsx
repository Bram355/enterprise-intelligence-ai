import type { ReactNode } from 'react'

const TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-brand-50 text-brand-900 ring-brand-100',
} as const

export function Alert({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </div>
  )
}
