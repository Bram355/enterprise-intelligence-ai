import { describe, expect, it } from 'vitest'
import { checkFile, formatBytes, MAX_UPLOAD_BYTES, parseTags, snippetParts } from './documents'

const file = (name: string, size: number) => {
  const f = new File(['x'], name)
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('document helpers', () => {
  it('parses comma separated tags', () => {
    expect(parseTags(' API, errors ,api,, Webhooks ')).toEqual(['api', 'errors', 'webhooks'])
  })

  it('splits search snippets into highlighted text parts without using HTML', () => {
    expect(snippetParts('Check the ⟦webhook⟧ <b>signature</b> ⟦secret⟧')).toEqual([
      { text: 'Check the ', highlight: false },
      { text: 'webhook', highlight: true },
      { text: ' <b>signature</b> ', highlight: false },
      { text: 'secret', highlight: true },
    ])
  })

  it('formats file sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('checks files before uploading', () => {
    expect(checkFile(null)).toBe('Choose a file to upload.')
    expect(checkFile(file('virus.exe', 10))).toMatch(/Only PDF/)
    expect(checkFile(file('empty.txt', 0))).toBe('The file is empty.')
    expect(checkFile(file('big.pdf', MAX_UPLOAD_BYTES + 1))).toBe('Files must be 20 MB or smaller.')
    expect(checkFile(file('guide.PDF', 100))).toBeNull()
  })
})
