import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAuthProvider } from '../../test/auth'
import { fakeAuth } from '../../test/fakes'
import { LoginPage } from './LoginPage'

const signIn = vi.fn()
vi.mock('../../services/auth', () => ({ signIn: (...args: unknown[]) => signIn(...args) }))

function renderLogin() {
  render(
    <FakeAuthProvider value={fakeAuth({ status: 'signed_out', session: null, profile: null })}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </FakeAuthProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => signIn.mockReset())

  it('requires email and password before calling the server', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.')
    expect(signIn).not.toHaveBeenCalled()
  })

  it('shows the server error message', async () => {
    signIn.mockResolvedValue({ ok: false, error: 'Email or password is incorrect.' })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'employee@northwind.test')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(signIn).toHaveBeenCalledWith('employee@northwind.test', 'wrong')
  })

  it('does not offer self sign-up', () => {
    renderLogin()
    expect(screen.queryByText(/create an account|sign up|register/i)).not.toBeInTheDocument()
  })
})
