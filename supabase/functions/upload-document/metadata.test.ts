import { describe, expect, it } from 'vitest'
import { parseMetadata, titleFromFileName } from './metadata'

const DEPT = '00000000-0000-4000-b000-000000000001'

describe('parseMetadata', () => {
  it('fills in defaults and normalises tags', () => {
    const result = parseMetadata({ tags: JSON.stringify([' API ', 'api', 'Errors']) }, 'payments_api-guide.pdf')
    expect(result).toEqual({
      ok: true,
      value: {
        documentId: null,
        title: 'payments api guide',
        description: '',
        categoryId: null,
        tags: ['api', 'errors'],
        visibility: 'organisation',
        departmentIds: [],
      },
    })
  })

  it('keeps departments only for department visibility', () => {
    const result = parseMetadata({ visibility: 'departments', departmentIds: JSON.stringify([DEPT, DEPT]) }, 'a.txt')
    expect(result.ok && result.value.departmentIds).toEqual([DEPT])
    const orgWide = parseMetadata({ visibility: 'organisation', departmentIds: JSON.stringify([DEPT]) }, 'a.txt')
    expect(orgWide.ok && orgWide.value.departmentIds).toEqual([])
  })

  it.each([
    [{ documentId: 'nope' }, 'Invalid document'],
    [{ title: 'x'.repeat(201) }, 'Title must be 200 characters or fewer'],
    [{ description: 'x'.repeat(2001) }, 'Description must be 2000 characters or fewer'],
    [{ categoryId: '1' }, 'Choose a valid category'],
    [{ tags: 'not json' }, 'Tags must be a list'],
    [{ tags: JSON.stringify(Array.from({ length: 21 }, (_, i) => `t${i}`)) }, 'Use at most 20 tags'],
    [{ tags: JSON.stringify(['x'.repeat(41)]) }, 'Tags must be 40 characters or fewer'],
    [{ visibility: 'public' }, 'Choose who can see this document'],
    [{ visibility: 'departments', departmentIds: '[]' }, 'Choose at least one department'],
    [{ visibility: 'departments', departmentIds: '["x"]' }, 'Choose valid departments'],
  ])('rejects %j', (fields, error) => {
    expect(parseMetadata(fields, 'a.txt')).toEqual({ ok: false, error })
  })

  it('derives a title from the file name', () => {
    expect(titleFromFileName('.pdf')).toBe('Untitled document')
  })
})
