import { describe, expect, it } from 'vitest'
import { passwordProblems } from './password'

describe('passwordProblems', () => {
  it('accepts a password that meets the policy', () => {
    expect(passwordProblems('Northwind2026')).toEqual([])
  })
  it.each([
    ['Short1a', 'at least 10 characters'],
    ['NOLOWERCASE123', 'a lowercase letter'],
    ['nouppercase123', 'an uppercase letter'],
    ['NoNumbersHere', 'a number'],
  ])('rejects %s', (password, problem) => {
    expect(passwordProblems(password)).toContain(problem)
  })
})
