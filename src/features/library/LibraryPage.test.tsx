import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import type { AuthContextValue } from '../auth/auth-context'
import { FakeAuthProvider } from '../../test/auth'
import { fakeAuth, fakeProfile } from '../../test/fakes'

const docs = [
  {
    id: 'd1', title: 'API troubleshooting', description: '', status: 'indexed', visibility: 'departments', tags: [],
    categoryId: 'c1', categoryName: 'Technical documentation', currentVersion: 1, archivedAt: null, processingError: null,
    updatedAt: '2026-11-04T00:00:00Z', departments: [{ id: 'dep1', name: 'Technical Support' }],
  },
  {
    id: 'd2', title: 'Old guide', description: '', status: 'indexed', visibility: 'organisation', tags: [],
    categoryId: null, categoryName: null, currentVersion: 2, archivedAt: '2026-11-04T00:00:00Z', processingError: null,
    updatedAt: '2026-11-04T00:00:00Z', departments: [],
  },
]
const searchDocuments = vi.fn()

vi.mock('../../services/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/documents')>()
  return {
    ...actual,
    listDocuments: vi.fn(async () => docs),
    listCategories: vi.fn(async () => [{ id: 'c1', name: 'Technical documentation' }]),
    searchDocuments: (...args: unknown[]) => searchDocuments(...args),
  }
})

function renderAt(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <FakeAuthProvider value={auth}>
      <RouterProvider router={router} />
    </FakeAuthProvider>,
  )
}

describe('Knowledge Library', () => {
  beforeEach(() => searchDocuments.mockReset())

  it('lets employees browse and search but not upload or manage', async () => {
    renderAt('/library', fakeAuth())
    expect(await screen.findByRole('link', { name: 'API troubleshooting' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /upload document/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Add a category' })).not.toBeInTheDocument()
  })

  it('shows managers the upload button, categories and archived filter', async () => {
    renderAt('/library', fakeAuth({ profile: fakeProfile('knowledge_manager') }))
    expect(await screen.findByRole('link', { name: /upload document/i })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Add a category' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Old guide' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'archived')
    expect(screen.getByRole('link', { name: 'Old guide' })).toBeInTheDocument()
    expect(screen.getByText('Archived', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows search results with highlighted matches', async () => {
    searchDocuments.mockResolvedValue([
      { documentId: 'd1', title: 'API troubleshooting', categoryName: 'Technical documentation', snippet: 'Verify the ⟦webhook⟧ signature', page: 2 },
    ])
    renderAt('/library', fakeAuth())
    await userEvent.type(await screen.findByLabelText('Search document contents'), 'webhook')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('webhook', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText(/page 2/)).toBeInTheDocument()
    expect(searchDocuments).toHaveBeenCalledWith('webhook')
  })

  it('blocks employees from the upload page', async () => {
    renderAt('/library/upload', fakeAuth())
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument()
  })

  it('lets managers open the upload form', async () => {
    renderAt('/library/upload', fakeAuth({ profile: fakeProfile('admin') }))
    expect(await screen.findByRole('form', { name: 'Upload a document' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a file to upload.')
  })
})
