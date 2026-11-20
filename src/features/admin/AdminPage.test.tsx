import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAuthProvider } from '../../test/auth'
import { fakeAuth, fakeProfile } from '../../test/fakes'
import { AdminPage } from './AdminPage'

const listMembers = vi.fn()
const listDepartments = vi.fn()
const listInvitations = vi.fn()
const updateMember = vi.fn()
const revokeInvitation = vi.fn()
const saveDepartment = vi.fn()
const deleteDepartment = vi.fn()
vi.mock('../../services/members', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/members')>()),
  listMembers: () => listMembers(),
  listDepartments: () => listDepartments(),
  listInvitations: () => listInvitations(),
  updateMember: (...args: unknown[]) => updateMember(...args),
  revokeInvitation: (...args: unknown[]) => revokeInvitation(...args),
  saveDepartment: (...args: unknown[]) => saveDepartment(...args),
  deleteDepartment: (...args: unknown[]) => deleteDepartment(...args),
}))
const listAuditLog = vi.fn()
vi.mock('../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/analytics')>()),
  listAuditLog: (...args: unknown[]) => listAuditLog(...args),
}))

const members = [
  { id: 'user-1', email: 'admin@northwind.test', fullName: 'Ada Admin', role: 'admin', isActive: true, departmentId: null, departmentName: null },
  { id: 'user-2', email: 'finance@northwind.test', fullName: 'Fin Person', role: 'employee', isActive: true, departmentId: 'd2', departmentName: 'Finance' },
]

function renderPage() {
  return render(
    <FakeAuthProvider value={fakeAuth({ profile: fakeProfile('admin') })}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </FakeAuthProvider>,
  )
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMembers.mockResolvedValue(members)
    listDepartments.mockResolvedValue([{ id: 'd1', name: 'Support' }, { id: 'd2', name: 'Finance' }])
    listInvitations.mockResolvedValue([
      { id: 'i1', email: 'new@northwind.test', role: 'employee', status: 'pending', departmentName: null, expiresAt: '2026-11-10T00:00:00Z', createdAt: '2026-11-03T00:00:00Z' },
    ])
    listAuditLog.mockResolvedValue({
      ok: true,
      value: [{ id: 1, action: 'member.updated', actorName: 'Ada Admin', targetType: 'profile', targetId: 'user-2', details: { role: { from: 'employee', to: 'knowledge_manager' } }, createdAt: '2026-11-03T10:00:00Z' }],
    })
    updateMember.mockResolvedValue({ ok: true })
    revokeInvitation.mockResolvedValue({ ok: true })
    saveDepartment.mockResolvedValue({ ok: true })
  })

  it('changes a member role and department through the admin function', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit finance@northwind.test' }))
    await userEvent.selectOptions(screen.getByLabelText('Role for finance@northwind.test'), 'knowledge_manager')
    await userEvent.selectOptions(screen.getByLabelText('Department for finance@northwind.test'), 'd1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateMember).toHaveBeenCalledWith('user-2', { role: 'knowledge_manager', departmentId: 'd1', isActive: true })
    expect(await screen.findByText('Fin Person was updated.')).toBeInTheDocument()
  })

  it('does not let admins change their own role or deactivate themselves', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit admin@northwind.test' }))
    expect(screen.getByLabelText('Role for admin@northwind.test')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeDisabled()
    expect(screen.getByText(/can't change your own role/)).toBeInTheDocument()
  })

  it('shows server-side refusals', async () => {
    updateMember.mockResolvedValue({ ok: false, error: 'The organisation needs at least one active admin' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit finance@northwind.test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('The organisation needs at least one active admin')).toBeInTheDocument()
  })

  it('cancels a pending invitation after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invitation for new@northwind.test' }))
    expect(revokeInvitation).toHaveBeenCalledWith('i1')
    await waitFor(() => expect(listInvitations).toHaveBeenCalledTimes(2))
  })

  it('adds and renames departments', async () => {
    renderPage()
    await userEvent.type(await screen.findByLabelText('New department name'), 'Legal')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(saveDepartment).toHaveBeenCalledWith('Legal', 'org-1')
    await userEvent.click(screen.getByRole('button', { name: 'Rename Support' }))
    const input = screen.getByLabelText('New name for Support')
    await userEvent.clear(input)
    await userEvent.type(input, 'Technical Support')
    await userEvent.click(within(input.closest('form')!).getByRole('button', { name: 'Save' }))
    expect(saveDepartment).toHaveBeenLastCalledWith('Technical Support', 'org-1', 'd1')
  })

  it('shows the audit log in plain English and filters it', async () => {
    renderPage()
    expect(await screen.findByText(/Member changed \(role: employee → knowledge_manager\)/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'support_case.')
    expect(listAuditLog).toHaveBeenLastCalledWith({ action: 'support_case.' })
  })
})
