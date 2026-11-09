import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAuthProvider } from '../../test/auth'
import { fakeAuth } from '../../test/fakes'
import { buildHandoff, shouldEscalate, type SupportCase } from '../../services/support'
import { SupportPage } from './SupportPage'

const diagnose = vi.fn()
const listCases = vi.fn()
const getCase = vi.fn()
const setStepOutcome = vi.fn()
const setCaseStatus = vi.fn()
vi.mock('../../services/support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/support')>()),
  diagnose: (...args: unknown[]) => diagnose(...args),
  listCases: (...args: unknown[]) => listCases(...args),
  getCase: (...args: unknown[]) => getCase(...args),
  setStepOutcome: (...args: unknown[]) => setStepOutcome(...args),
  setCaseStatus: (...args: unknown[]) => setCaseStatus(...args),
}))

const sample: SupportCase = {
  id: 'case-1',
  userId: 'user-1',
  title: 'T-102: Terminal offline in store 14',
  category: 'pos_terminal',
  problem: 'Terminal offline in store 14',
  errorCode: 'T-102',
  environment: 'live',
  status: 'open',
  summary: 'The terminal has lost its network connection.',
  causes: [{ text: 'The network cable is unplugged', citations: [1] }],
  escalation: { text: 'Escalate to Field Engineering with the terminal serial number.', citations: [1] },
  sources: [{ n: 1, documentId: 'd1', title: 'POS terminal troubleshooting', version: 1, page: null, section: 'T-102', excerpt: '' }],
  provider: 'mock',
  model: 'mock-extractive',
  createdAt: '2026-11-03T10:00:00Z',
  steps: [
    { id: 11, position: 1, action: 'Check the network cable', expected: 'The network light turns green', citations: [1], outcome: 'pending' },
    { id: 12, position: 2, action: 'Restart the terminal', expected: null, citations: [1], outcome: 'pending' },
  ],
}

function renderPage(path = '/support', auth = fakeAuth()) {
  render(
    <FakeAuthProvider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/support/:caseId?" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    </FakeAuthProvider>,
  )
}

describe('support helpers', () => {
  it('escalates only when nothing is left to try or nothing was found', () => {
    expect(shouldEscalate(sample)).toBe(false)
    const tried = { ...sample, steps: sample.steps.map((s) => ({ ...s, outcome: 'not_fixed' as const })) }
    expect(shouldEscalate(tried)).toBe(true)
    expect(shouldEscalate({ ...tried, steps: [{ ...tried.steps[0], outcome: 'fixed' }] })).toBe(false)
    expect(shouldEscalate({ ...sample, steps: [] })).toBe(true)
  })

  it('builds a handoff with steps, outcomes and sources', () => {
    const text = buildHandoff({ ...sample, steps: [{ ...sample.steps[0], outcome: 'not_fixed' }, sample.steps[1]] })
    expect(text).toContain('Error code: T-102')
    expect(text).toContain("1. Check the network cable (didn't help)")
    expect(text).toContain('2. Restart the terminal (not tried)')
    expect(text).toContain('Escalation guidance: Escalate to Field Engineering')
    expect(text).toContain('- POS terminal troubleshooting')
  })
})

describe('SupportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCases.mockResolvedValue({ ok: true, value: [] })
    getCase.mockResolvedValue({ ok: true, value: sample })
    setStepOutcome.mockResolvedValue({ ok: true, value: null })
    setCaseStatus.mockResolvedValue({ ok: true, value: null })
  })

  it('validates the problem before diagnosing', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('What is happening?'), 'broken')
    await userEvent.click(screen.getByRole('button', { name: /diagnose/i }))
    expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument()
    expect(diagnose).not.toHaveBeenCalled()
  })

  it('sends category, error code and environment, then opens the new case', async () => {
    diagnose.mockResolvedValue({ ok: true, value: { caseId: 'case-1', status: 'diagnosed' } })
    renderPage()
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'pos_terminal')
    await userEvent.type(screen.getByLabelText('Error code (optional)'), 'T-102')
    await userEvent.selectOptions(screen.getByLabelText('Environment'), 'live')
    await userEvent.type(screen.getByLabelText('What is happening?'), 'Terminal offline in store 14')
    await userEvent.click(screen.getByRole('button', { name: /diagnose/i }))
    expect(diagnose).toHaveBeenCalledWith({ category: 'pos_terminal', errorCode: 'T-102', environment: 'live', problem: 'Terminal offline in store 14' })
    expect(await screen.findByText('Check the network cable')).toBeInTheDocument()
    expect(getCase).toHaveBeenCalledWith('case-1')
  })

  it('shows causes, steps, expected outcomes and linked sources', async () => {
    renderPage('/support/case-1')
    expect(await screen.findByText('The network cable is unplugged')).toBeInTheDocument()
    expect(screen.getByText('The network light turns green')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /POS terminal troubleshooting/ })).toHaveAttribute('href', '/library/d1')
    expect(screen.queryByText('Escalation')).not.toBeInTheDocument()
  })

  it('records step outcomes and recommends escalation when nothing helped', async () => {
    renderPage('/support/case-1')
    const steps = await screen.findAllByRole('button', { name: "Didn't help" })
    await userEvent.click(steps[0])
    expect(setStepOutcome).toHaveBeenCalledWith(11, 'not_fixed')
    await userEvent.click(screen.getAllByRole('button', { name: 'Skip' })[1])
    expect(await screen.findByText('Escalation')).toBeInTheDocument()
    expect((screen.getByLabelText('Handoff summary') as HTMLTextAreaElement).value).toContain("Check the network cable (didn't help)")
    await userEvent.click(screen.getByRole('button', { name: 'Mark as escalated' }))
    expect(setCaseStatus).toHaveBeenCalledWith('case-1', 'escalated')
  })

  it('resolves the case when a step fixes the problem', async () => {
    renderPage('/support/case-1')
    await userEvent.click((await screen.findAllByRole('button', { name: 'Fixed it' }))[0])
    expect(setStepOutcome).toHaveBeenCalledWith(11, 'fixed')
    expect(setCaseStatus).toHaveBeenCalledWith('case-1', 'resolved')
    expect(await screen.findByText(/Marked as resolved/)).toBeInTheDocument()
  })

  it('offers escalation straight away when no document covers the problem', async () => {
    getCase.mockResolvedValue({ ok: true, value: { ...sample, steps: [], causes: [], escalation: null, summary: null, sources: [] } })
    renderPage('/support/case-1')
    expect(await screen.findByText(/No document you can access covers this problem/)).toBeInTheDocument()
    expect(screen.getByText(/doesn't name a team/)).toBeInTheDocument()
  })

  it('lets admins view but not change another person\'s case', async () => {
    getCase.mockResolvedValue({ ok: true, value: { ...sample, userId: 'someone-else' } })
    renderPage('/support/case-1', fakeAuth({ profile: { ...fakeAuth().profile!, role: 'admin' } }))
    const buttons = await screen.findAllByRole('button', { name: 'Fixed it' })
    expect(buttons[0]).toBeDisabled()
  })

  it('shows an error for a case the user cannot see', async () => {
    getCase.mockResolvedValue({ ok: false, error: 'Case not found.' })
    renderPage('/support/missing')
    expect(await screen.findByText('Case not found.')).toBeInTheDocument()
  })

  it('lists saved cases with their status', async () => {
    listCases.mockResolvedValue({ ok: true, value: [{ id: 'case-1', title: 'T-102: Terminal offline', status: 'escalated', category: 'pos_terminal', updatedAt: '' }] })
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /T-102: Terminal offline/ }).length).toBeGreaterThan(0))
    expect(screen.getAllByText('Escalated').length).toBeGreaterThan(0)
  })
})
