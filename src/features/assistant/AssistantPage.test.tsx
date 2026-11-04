import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answerParts } from '../../services/assistant'
import { AssistantPage } from './AssistantPage'

const askQuestion = vi.fn()
vi.mock('../../services/assistant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/assistant')>()),
  askQuestion: (...args: unknown[]) => askQuestion(...args),
}))

const base = { queryId: 'q1', sourcesConsidered: 2, provider: 'mock', model: 'mock-extractive' }

function renderPage() {
  render(
    <MemoryRouter>
      <AssistantPage />
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
  beforeEach(() => askQuestion.mockReset())

  it('shows an answer with numbered sources linking to the library', async () => {
    askQuestion.mockResolvedValue({
      ok: true,
      value: {
        ...base,
        status: 'answered',
        answer: 'Rotate the signing secret [1]. <img src=x onerror=alert(1)>',
        citations: [{ n: 1, documentId: 'd1', title: 'Payments API troubleshooting guide', version: 1, page: 2, excerpt: 'Webhook signature…' }],
      },
    })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'Webhook signature errors?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(askQuestion).toHaveBeenCalledWith('Webhook signature errors?')
    expect(await screen.findByRole('link', { name: /Payments API troubleshooting guide/ })).toHaveAttribute('href', '/library/d1')
    expect(screen.getByRole('link', { name: 'Source 1' })).toBeInTheDocument()
    expect(screen.getByText(/page 2 · version 1/)).toBeInTheDocument()
    expect(screen.getByTestId('answer')).toHaveTextContent('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img')).toBeNull()
  })

  it('says when nothing in the permitted documents answers the question', async () => {
    askQuestion.mockResolvedValue({ ok: true, value: { ...base, status: 'no_answer', answer: "I couldn't find this in the documents you have access to.", citations: [], sourcesConsidered: 0 } })
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'Hotel limits?{Enter}')
    expect(await screen.findByText("I couldn't find this in the documents you have access to.")).toBeInTheDocument()
    expect(screen.queryByText('Sources')).not.toBeInTheDocument()
  })

  it('validates short questions and shows server errors', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Your question'), 'hi')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByRole('alert')).toHaveTextContent('at least 3 characters')
    expect(askQuestion).not.toHaveBeenCalled()

    askQuestion.mockResolvedValue({ ok: false, error: 'You have asked a lot of questions this hour. Please try again later.' })
    await userEvent.type(screen.getByLabelText('Your question'), ' there')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('a lot of questions')
  })
})
