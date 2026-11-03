import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('app routes', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/assistant', 'AI Assistant'],
    ['/library', 'Knowledge Library'],
    ['/support', 'Technical Support'],
    ['/admin', 'Administration'],
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
})
