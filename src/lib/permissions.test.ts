import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can', () => {
  it('only lets admins invite members and view administration', () => {
    expect(can('admin', 'members.invite')).toBe(true)
    expect(can('admin', 'admin.view')).toBe(true)
    expect(can('knowledge_manager', 'members.invite')).toBe(false)
    expect(can('employee', 'admin.view')).toBe(false)
  })
  it('lets admins and knowledge managers manage documents', () => {
    expect(can('admin', 'documents.manage')).toBe(true)
    expect(can('knowledge_manager', 'documents.manage')).toBe(true)
    expect(can('employee', 'documents.manage')).toBe(false)
  })
  it('denies everything when there is no role', () => {
    expect(can(null, 'admin.view')).toBe(false)
    expect(can(undefined, 'documents.manage')).toBe(false)
  })
})
