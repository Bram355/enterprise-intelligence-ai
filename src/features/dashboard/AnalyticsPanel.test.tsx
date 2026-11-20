import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analytics } from '../../services/analytics'
import { AnalyticsPanel } from './AnalyticsPanel'

const getAnalytics = vi.fn()
vi.mock('../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/analytics')>()),
  getAnalytics: (...args: unknown[]) => getAnalytics(...args),
}))

const sample: Analytics = {
  since: '2026-10-05T00:00:00Z',
  documents: { total: 12, indexed: 11, failed: 1, processing: 0, archived: 2, added: 3 },
  failedDocuments: [{ id: 'doc-9', title: 'Scanned invoice', error: 'No readable text found', updatedAt: '2026-11-02T00:00:00Z' }],
  questions: { total: 20, answered: 15, unanswered: 4, clarifications: 1, failed: 0, medianLatencyMs: 9000 },
  perDay: [{ day: '2026-11-02', total: 5, unanswered: 1 }, { day: '2026-11-03', total: 15, unanswered: 3 }],
  topUnanswered: [{ question: 'What is the parental leave policy?', count: 3, lastAsked: '2026-11-03T00:00:00Z' }],
  topDocuments: [{ documentId: 'doc-1', title: 'Webhook guide', count: 7 }],
  feedback: { helpful: 6, notHelpful: 2, incorrect: 1, missingDocs: 1 },
  recentNegativeFeedback: [{ question: 'Refund timelines?', comment: 'Out of date', reason: 'incorrect', createdAt: '2026-11-03T00:00:00Z' }],
  support: { total: 4, open: 1, resolved: 2, escalated: 1, byCategory: { pos_terminal: 3, webhooks: 1 } },
  users: { total: 5, active: 5, askedQuestions: 3 },
}

describe('AnalyticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAnalytics.mockResolvedValue({ ok: true, value: sample })
  })

  it('shows real figures from the database', async () => {
    render(<MemoryRouter><AnalyticsPanel /></MemoryRouter>)
    expect(await screen.findByText('Questions asked')).toBeInTheDocument()
    expect(screen.getByText('75% answered')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('11 / 12')).toBeInTheDocument()
    expect(screen.getByText('What is the parental leave policy?')).toBeInTheDocument()
    expect(screen.getByText(/Wrong answer · “Out of date”/)).toBeInTheDocument()
    expect(screen.getByText('Pos terminal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scanned invoice' })).toHaveAttribute('href', '/library/doc-9')
    expect(screen.getByText('No readable text found')).toBeInTheDocument()
  })

  it('reloads for a different period', async () => {
    render(<MemoryRouter><AnalyticsPanel /></MemoryRouter>)
    await screen.findByText('Questions asked')
    await userEvent.selectOptions(screen.getByLabelText('Period'), '7')
    expect(getAnalytics).toHaveBeenLastCalledWith(7)
  })

  it('shows an error instead of figures when analytics are not available', async () => {
    getAnalytics.mockResolvedValue({ ok: false, error: 'Could not load analytics.' })
    render(<MemoryRouter><AnalyticsPanel /></MemoryRouter>)
    expect(await screen.findByText('Could not load analytics.')).toBeInTheDocument()
    expect(screen.queryByText('Questions asked')).not.toBeInTheDocument()
  })
})
