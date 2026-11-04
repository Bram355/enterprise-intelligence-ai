import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { docxXmlToText, extractSegments } from './extract'

const sample = async (name: string) => new Uint8Array(await readFile(resolve(process.cwd(), 'samples', name)))

describe('extractSegments', () => {
  it('reads PDF text page by page', async () => {
    const pages = await extractSegments('pdf', await sample('northwind-payments-api-troubleshooting.pdf'))
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({ page: 1 })
    expect(pages[0].text).toContain('PAY-401')
    expect(pages[1].text).toContain('HMAC-SHA256')
  })

  it('reads Word documents', async () => {
    const [segment] = await extractSegments('docx', await sample('northwind-refund-policy.docx'))
    expect(segment.text).toContain('within 30 days of purchase')
    expect(segment.text).toContain('Chargebacks')
  })

  it('reads UTF-8 text and drops a byte-order mark', async () => {
    const [segment] = await extractSegments('text', new TextEncoder().encode('\uFEFFCafé menu'))
    expect(segment.text).toBe('Café menu')
  })

  it('rejects damaged files with a clear message', async () => {
    await expect(extractSegments('pdf', new TextEncoder().encode('%PDF-garbage'))).rejects.toThrow('The PDF could not be read')
    await expect(extractSegments('docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).rejects.toThrow('could not be opened')
  })
})

describe('docxXmlToText', () => {
  it('turns paragraphs into blank-line separated text and decodes entities', () => {
    const xml = '<w:p><w:r><w:t>Fish &amp; chips</w:t></w:r></w:p><w:p><w:r><w:t>A</w:t><w:tab/><w:t>B &#169;</w:t></w:r></w:p>'
    expect(docxXmlToText(xml)).toBe('Fish & chips\n\nA\tB ©\n\n')
  })
})
