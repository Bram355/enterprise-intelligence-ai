import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AuthContextValue } from '../features/auth/auth-context'
import { FakeAuthProvider } from '../test/auth'
import { fakeAuth, fakeProfile } from '../test/fakes'
import { routes } from './routes'

function renderAt(path: string, auth: AuthContextValue = fakeAuth()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <FakeAuthProvider value={auth}>
      <RouterProvider router={router} />
    </FakeAuthProvider>,
  )
  return router
}

const admin = () => fakeAuth({ profile: fakeProfile('admin') })

describe('app routes (signed in)', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/assistant', 'AI Assistant'],
    ['/library', 'Knowledge Library'],
    ['/support', 'Technical Support'],
    ['/profile', 'Your profile'],
  ])('renders %s', async (path, heading) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows not found for unknown paths', async () => {
    renderAt('/does-not-exist')
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })

  it('navigates using the sidebar', async () => {
    const router = renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'Knowledge Library' }))
    expect(router.state.location.pathname).toBe('/library')
    expect(await screen.findByRole('heading', { level: 1, name: 'Knowledge Library' })).toBeInTheDocument()
  })

  it('labels unbuilt features honestly', async () => {
    renderAt('/assistant')
    expect(await screen.findByText('Planned for Phase 5')).toBeInTheDocument()
  })

  it('shows the signed-in user and role', async () => {
    renderAt('/')
    expect(await screen.findByText('Test Person')).toBeInTheDocument()
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})

describe('role-based access in the interface', () => {
  it('hides Administration from employees and blocks the page', async () => {
    renderAt('/admin')
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('blocks knowledge managers from Administration', async () => {
    renderAt('/admin', fakeAuth({ profile: fakeProfile('knowledge_manager') }))
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument()
  })

  it('shows Administration to admins', async () => {
    renderAt('/admin', admin())
    expect(await screen.findByRole('heading', { level: 1, name: 'Administration' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Invite a member' })).toBeInTheDocument()
  })
})

describe('route guards', () => {
  it('redirects signed-out visitors to sign in', async () => {
    const router = renderAt('/library', fakeAuth({ status: 'signed_out', session: null, profile: null }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('blocks accounts without an active profile', async () => {
    renderAt('/', fakeAuth({ status: 'no_profile', profile: null }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Account not available' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('explains when the backend is not configured', async () => {
    renderAt('/', fakeAuth({ status: 'unconfigured', session: null, profile: null }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Backend not configured' })).toBeInTheDocument()
  })

  it('rejects an invitation link without a valid session', async () => {
    renderAt('/accept-invite', fakeAuth({ status: 'signed_out', session: null, profile: null }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Invitation link not valid' })).toBeInTheDocument()
  })
})
