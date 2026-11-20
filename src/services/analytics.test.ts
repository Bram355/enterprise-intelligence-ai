import { describe, expect, it } from 'vitest'
import { describeAudit, type AuditEntry } from './analytics'

const entry = (action: string, details: Record<string, unknown> = {}): AuditEntry => ({
  id: 1, action, actorName: 'Ada', targetType: null, targetId: null, details, createdAt: '2026-11-03T10:00:00Z',
})

describe('describeAudit', () => {
  it('describes member changes', () => {
    expect(describeAudit(entry('member.updated', { is_active: { from: true, to: false } }))).toBe('Member changed (active: true → false)')
  })
  it('describes invitations, documents and support cases', () => {
    expect(describeAudit(entry('invitation.revoked', { email: 'a@b.test' }))).toBe('Revoked invitation for "a@b.test"')
    expect(describeAudit(entry('document.archived', { title: 'Expense policy' }))).toBe('Document archived "Expense policy"')
    expect(describeAudit(entry('support_case.escalated', { title: 'Till offline' }))).toBe('Support case escalated "Till offline"')
  })
})
