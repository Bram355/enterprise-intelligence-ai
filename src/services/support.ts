import { requireSupabase } from '../lib/supabase'
import type { Citation } from './assistant'
import { functionErrorMessage } from './errors'

export const SUPPORT_CATEGORIES = {
  api_auth: 'API integration and authentication',
  http_errors: 'HTTP error codes',
  payments: 'Payment failures',
  pos_terminal: 'POS and terminal connectivity',
  webhooks: 'Webhooks and callbacks',
  sdk_plugins: 'SDK and plugin issues',
  other: 'Other technical issue',
} as const
export type SupportCategory = keyof typeof SUPPORT_CATEGORIES
export type Environment = 'sandbox' | 'live' | 'unknown'
export type CaseStatus = 'open' | 'resolved' | 'escalated'
export type StepOutcome = 'pending' | 'fixed' | 'not_fixed' | 'skipped'

export const MAX_PROBLEM_CHARS = 2000

export interface CitedText {
  text: string
  citations: number[]
}

export interface CaseStep {
  id: number
  position: number
  action: string
  expected: string | null
  citations: number[]
  outcome: StepOutcome
}

export interface SupportCase {
  id: string
  userId: string
  title: string
  category: SupportCategory
  problem: string
  errorCode: string | null
  environment: Environment
  status: CaseStatus
  summary: string | null
  causes: CitedText[]
  escalation: CitedText | null
  sources: Citation[]
  provider: string
  model: string
  createdAt: string
  steps: CaseStep[]
}

export interface CaseSummary {
  id: string
  title: string
  status: CaseStatus
  category: SupportCategory
  updatedAt: string
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface DiagnoseInput {
  category: SupportCategory
  problem: string
  errorCode?: string
  environment: Environment
}

export async function diagnose(input: DiagnoseInput): Promise<Result<{ caseId: string; status: 'diagnosed' | 'no_answer' }>> {
  const { data, error } = await requireSupabase().functions.invoke<{ caseId: string; status: 'diagnosed' | 'no_answer' }>('troubleshoot', {
    body: { ...input, errorCode: input.errorCode?.trim() || null },
  })
  if (error || !data) return { ok: false, error: await functionErrorMessage(error) }
  return { ok: true, value: data }
}

export async function listCases(): Promise<Result<CaseSummary[]>> {
  const { data, error } = await requireSupabase()
    .from('support_cases')
    .select('id, title, status, category, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return { ok: false, error: 'Could not load support cases.' }
  return { ok: true, value: data.map((c) => ({ id: c.id, title: c.title, status: c.status, category: c.category, updatedAt: c.updated_at })) }
}

export async function getCase(id: string): Promise<Result<SupportCase>> {
  const { data, error } = await requireSupabase()
    .from('support_cases')
    .select('*, support_case_steps(id, position, action, expected, citations, outcome)')
    .eq('id', id)
    .maybeSingle()
  if (error) return { ok: false, error: 'Could not load this case.' }
  if (!data) return { ok: false, error: 'Case not found.' }
  return {
    ok: true,
    value: {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      category: data.category,
      problem: data.problem,
      errorCode: data.error_code,
      environment: data.environment as Environment,
      status: data.status,
      summary: data.summary,
      causes: (data.causes as unknown as CitedText[]) ?? [],
      escalation: (data.escalation as unknown as CitedText | null) ?? null,
      sources: (data.sources as unknown as Citation[]) ?? [],
      provider: data.provider,
      model: data.model,
      createdAt: data.created_at,
      steps: [...(data.support_case_steps ?? [])].sort((a, b) => a.position - b.position),
    },
  }
}

export async function setStepOutcome(stepId: number, outcome: StepOutcome): Promise<Result<null>> {
  const { error } = await requireSupabase().from('support_case_steps').update({ outcome }).eq('id', stepId)
  if (error) return { ok: false, error: 'Could not save this step.' }
  return { ok: true, value: null }
}

export async function setCaseStatus(caseId: string, status: CaseStatus): Promise<Result<null>> {
  const { error } = await requireSupabase().from('support_cases').update({ status }).eq('id', caseId)
  if (error) return { ok: false, error: 'Could not update the case.' }
  return { ok: true, value: null }
}

/** Escalate when nothing was found, or every step has been tried without fixing the problem. */
export function shouldEscalate(c: SupportCase): boolean {
  if (c.steps.length === 0) return true
  return !c.steps.some((s) => s.outcome === 'fixed' || s.outcome === 'pending')
}

const OUTCOME_LABEL: Record<StepOutcome, string> = { pending: 'not tried', fixed: 'fixed it', not_fixed: "didn't help", skipped: 'skipped' }

/** Plain-text summary for handing the case to another team. */
export function buildHandoff(c: SupportCase): string {
  const sourceName = (n: number) => c.sources.find((s) => s.n === n)?.title
  const lines = [
    `Support case: ${c.title}`,
    `Category: ${SUPPORT_CATEGORIES[c.category]}`,
    c.errorCode ? `Error code: ${c.errorCode}` : null,
    `Environment: ${c.environment}`,
    `Reported: ${new Date(c.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    'Problem:',
    c.problem,
    '',
    'Steps tried:',
    ...(c.steps.length ? c.steps.map((s) => `${s.position}. ${s.action} (${OUTCOME_LABEL[s.outcome]})`) : ['None: no matching documentation was found.']),
  ]
  if (c.escalation) lines.push('', `Escalation guidance: ${c.escalation.text}`)
  const used = [...new Set([...c.steps.flatMap((s) => s.citations), ...(c.escalation?.citations ?? [])])]
  if (used.length) lines.push('', 'Sources:', ...used.map((n) => `- ${sourceName(n) ?? `Source ${n}`}`))
  return lines.filter((l) => l !== null).join('\n')
}
