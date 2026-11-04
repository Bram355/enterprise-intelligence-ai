import { describe, expect, it } from 'vitest'
import { parseInviteInput } from './validate'

const DEPT = '00000000-0000-4000-b000-000000000002'

describe('parseInviteInput', () => {
  it('normalises a valid request', () => {
    const result = parseInviteInput({ email: '  New@Northwind.TEST ', role: 'employee', departmentId: DEPT, fullName: ' Nia ' })
    expect(result).toEqual({
      ok: true,
      value: { email: 'new@northwind.test', role: 'employee', departmentId: DEPT, fullName: 'Nia', redirectTo: null },
    })
  })
  it.each([
    [null, 'Request body must be a JSON object'],
    [{ email: 'not-an-email', role: 'employee' }, 'Enter a valid email address'],
    [{ email: 'a@b.co', role: 'super_admin' }, 'Choose a valid role'],
    [{ email: 'a@b.co', role: 'employee', departmentId: 'x' }, 'Choose a valid department'],
    [{ email: 'a@b.co', role: 'employee', fullName: 'x'.repeat(121) }, 'Name must be 120 characters or fewer'],
    [{ email: 'a@b.co', role: 'employee', redirectTo: 'javascript:alert(1)' }, 'Invalid redirect URL'],
  ])('rejects %j', (body, error) => {
    expect(parseInviteInput(body)).toEqual({ ok: false, error })
  })
})
