import { describe, expect, it } from 'vitest'
import { detectFileKind, MAX_FILE_BYTES, safeFileName } from './file-type'

const enc = (s: string) => new TextEncoder().encode(s)

describe('detectFileKind', () => {
  it('accepts supported files whose contents match the extension', () => {
    expect(detectFileKind('a.pdf', enc('%PDF-1.7 ...'))).toEqual({ ok: true, kind: 'pdf' })
    expect(detectFileKind('a.docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]))).toEqual({ ok: true, kind: 'docx' })
    expect(detectFileKind('a.TXT', enc('hello'))).toEqual({ ok: true, kind: 'text' })
    expect(detectFileKind('notes.md', enc('# hi'))).toEqual({ ok: true, kind: 'markdown' })
  })

  it.each([
    ['a.exe', enc('MZ'), 'Only PDF, Word (.docx), text (.txt) and Markdown (.md) files are supported'],
    ['a.pdf', enc('<html>'), 'This file is not a valid PDF'],
    ['a.docx', enc('%PDF-'), 'This file is not a valid Word document'],
    ['a.txt', new Uint8Array([104, 0, 105]), 'This file is not a plain text file'],
    ['a.txt', new Uint8Array([0xff, 0xfe, 0x41]), 'Text files must be UTF-8 encoded'],
    ['a.txt', new Uint8Array(), 'The file is empty'],
  ])('rejects %s with bad contents', (name, bytes, error) => {
    expect(detectFileKind(name, bytes)).toEqual({ ok: false, error })
  })

  it('rejects files over 20 MB', () => {
    expect(detectFileKind('a.txt', new Uint8Array(MAX_FILE_BYTES + 1))).toEqual({ ok: false, error: 'Files must be 20 MB or smaller' })
  })
})

describe('safeFileName', () => {
  it('strips paths and unsafe characters', () => {
    expect(safeFileName('../../etc/pass wd?.txt')).toBe('pass-wd.txt')
    expect(safeFileName('C:\\Users\\me\\Report (final).pdf')).toBe('Report-final.pdf')
    expect(safeFileName('...')).toBe('document')
  })
})
