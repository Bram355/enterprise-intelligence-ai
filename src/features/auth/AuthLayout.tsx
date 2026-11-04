import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="rounded-md bg-brand-600 p-1.5 text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-slate-900">Enterprise Intelligence AI</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
