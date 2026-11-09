import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answerParts } from '../../services/assistant'
import { AssistantPage } from './AssistantPage'

const askQuestion = vi.fn()
const listConversations = vi.fn()
const getConversationMessages = vi.fn()
const submitFeedback = vi.fn()
const deleteConversation = vi.fn()
vi.mock('../../services/assistant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/assistant')>()),
  askQuestion: (...args: unknown[]) => askQuestion(...args),
  listConversations: (...args: unknown[]) => listConversations(...args),
  getConversationMessages: (...args: unknown[]) => getConversationMessages(...args),
  submitFeedback: (...args: unknown[]) => submitFeedback(...args),
  deleteConversation: (...args: unknown[]) => deleteConversation(...args),
}))

const base = { queryId: 'q1', conversationId: 'c1', sourcesConsidered: 2, provider: 'mock', model: 'mock-extractive' }
const citation = { n: 1, documentId: 'd1', title: 'Payments API troubleshooting guide', version: 1, page: 2, section: 'Webhooks', excerpt: 'Webhook signature…' }

function renderPage(path = '/assistant') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/assistant/:conversationId?" element={<AssistantPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('answerParts', () => {
  it('splits citation markers from text', () => {
    expect(answerParts('Check the secret [1]. <b>Then</b> retry [2]')).toEqual([
      { text: 'Check the secret ' },
      { text: '[1]', cite: 1 },
      { text: '. <b>Then</b> retry ' },
      { text: '[2]', cite: 2 },
    ])
  })
})

describe('AssistantPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listConversations.mockResolvedValue({ ok: true, value: [] })
    getConversationMessages.mockResolvedValue({ ok: true, value: [] })
    submitFeedback.mockResolvedValue({ ok: true, value: null })
    deleteConversation.mockResolvedValue({ ok: true, value: null })
  })

  it('shows an answer with numbered sources and section references', async () => {
    askQuestion.mockResolvedValue({
      ok: true,
      value: { ...base, status: 'answered', answer: 'Rotate the signing secret [1]. <img src=x onerror=alert(1)>', citations: [citation] },
    })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'Webhook signature errors?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(askQuestion).toHaveBeenCalledWith('Webhook signature errors?', undefined)
    expect(await screen.findByRole('link', { name: /Payments API troubleshooting guide/ })).toHaveAttribute('href', '/library/d1')
    expect(screen.getByRole('link', { name: 'Source 1' })).toBeInTheDocument()
    expect(screen.getByText(/“Webhooks” · page 2 · version 1/)).toBeInTheDocument()
    expect(screen.getByTestId('answer')).toHaveTextContent('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByLabelText('Ask a follow-up')).toBeInTheDocument()
  })

  it('sends follow-ups in the same conversation', async () => {
    askQuestion
      .mockResolvedValueOnce({ ok: true, value: { ...base, status: 'answered', answer: 'Card payments settle on T+2 [1].', citations: [citation] } })
      .mockResolvedValueOnce({ ok: true, value: { ...base, queryId: 'q2', status: 'answered', answer: 'Bank transfers settle on T+1 [1].', citations: [citation] } })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'How do card payments settle?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await userEvent.type(await screen.findByLabelText('Ask a follow-up'), 'And bank transfers?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(askQuestion).toHaveBeenLastCalledWith('And bank transfers?', 'c1')
    expect(await screen.findByText(/Bank transfers settle on T\+1/)).toBeInTheDocument()
    expect(screen.getByText(/Card payments settle on T\+2/)).toBeInTheDocument()
  })

  it('reopens a saved conversation from history', async () => {
    listConversations.mockResolvedValue({ ok: true, value: [{ id: 'c9', title: 'Hotel limits', updatedAt: '2026-11-03T10:00:00Z' }] })
    getConversationMessages.mockResolvedValue({
      ok: true,
      value: [{ id: 'q9', question: 'Hotel limit?', answer: 'Up to GBP 180 in London [1].', status: 'answered', citations: [citation], provider: 'ollama', model: 'qwen2.5:3b', feedback: { rating: 'helpful', comment: null } }],
    })
    renderPage('/assistant/c9')
    expect(await screen.findByText(/Up to GBP 180 in London/)).toBeInTheDocument()
    expect(getConversationMessages).toHaveBeenCalledWith('c9')
    expect(screen.getAllByRole('link', { name: 'Hotel limits' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/written by qwen2.5:3b \(ollama\)/)).toBeInTheDocument()
  })

  it('shows clarifying questions distinctly', async () => {
    askQuestion.mockResolvedValue({ ok: true, value: { ...base, status: 'needs_clarification', answer: 'Could you clarify whether you mean refunds or chargebacks?', citations: [] } })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'How long?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('The assistant needs more detail')).toBeInTheDocument()
    expect(screen.queryByText(/No sources were cited/)).not.toBeInTheDocument()
  })

  it('says when nothing in the permitted documents answers the question', async () => {
    askQuestion.mockResolvedValue({ ok: true, value: { ...base, status: 'no_answer', answer: "I couldn't find this in the documents you have access to.", citations: [], sourcesConsidered: 0 } })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'Hotel limit?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/couldn't find this in the documents you have access to/)).toBeInTheDocument()
    expect(screen.queryByText('Sources')).not.toBeInTheDocument()
  })

  it('saves helpful and not helpful feedback with an optional comment', async () => {
    askQuestion.mockResolvedValue({ ok: true, value: { ...base, status: 'answered', answer: 'Rotate the secret [1].', citations: [citation] } })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'Webhook errors?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Helpful' }))
    expect(submitFeedback).toHaveBeenCalledWith('q1', 'helpful', undefined)
    expect(await screen.findByText('Thanks for the feedback.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Not helpful' }))
    await userEvent.type(screen.getByPlaceholderText(/What was wrong/), 'Missing step')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(submitFeedback).toHaveBeenLastCalledWith('q1', 'not_helpful', 'Missing step')
  })

  it('deletes a conversation after confirmation', async () => {
    listConversations.mockResolvedValue({ ok: true, value: [{ id: 'c9', title: 'Hotel limits', updatedAt: '2026-11-03T10:00:00Z' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete conversation Hotel limits' }))[0])
    expect(deleteConversation).toHaveBeenCalledWith('c9')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Hotel limits' })).not.toBeInTheDocument())
  })

  it('starts a clean conversation after an error in another one', async () => {
    askQuestion.mockResolvedValue({ ok: false, error: 'Conversation not found' })
    renderPage('/assistant/c-other')
    await userEvent.type(await screen.findByLabelText('Ask a follow-up'), 'And bank transfers?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('Conversation not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(await screen.findByLabelText('Your question')).toHaveValue('')
    expect(screen.queryByText('Conversation not found')).not.toBeInTheDocument()
  })

  it('validates short questions and shows errors', async () => {
    askQuestion.mockResolvedValue({ ok: false, error: 'You have asked a lot of questions. Try again later.' })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'hi')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByText('Type a question of at least 3 characters.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Your question'))
    await userEvent.type(screen.getByLabelText('Your question'), 'Webhook errors?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/asked a lot of questions/)).toBeInTheDocument()
    expect(screen.getByLabelText('Your question')).toHaveValue('Webhook errors?')
  })
})
