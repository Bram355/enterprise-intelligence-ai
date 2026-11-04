import { unzipSync } from 'fflate'
import { extractText, getDocumentProxy } from 'unpdf'
import type { FileKind } from './file-type.ts'
import type { TextSegment } from './chunk.ts'

const MAX_DOCX_XML_BYTES = 50 * 1024 * 1024

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

export function docxXmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:(br|cr)\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
}

export function extractDocx(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, {
      filter: (file) => file.name === 'word/document.xml' && file.originalSize <= MAX_DOCX_XML_BYTES,
    })
  } catch {
    throw new Error('The Word document could not be opened. It may be damaged or password protected.')
  }
  const xml = files['word/document.xml']
  if (!xml) throw new Error('The Word document has no readable content.')
  return docxXmlToText(new TextDecoder().decode(xml))
}

export async function extractPdf(bytes: Uint8Array): Promise<TextSegment[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { text } = await extractText(pdf, { mergePages: false })
    return text.map((pageText, i) => ({ page: i + 1, text: pageText }))
  } catch {
    throw new Error('The PDF could not be read. It may be damaged or password protected.')
  }
}

export async function extractSegments(kind: FileKind, bytes: Uint8Array): Promise<TextSegment[]> {
  switch (kind) {
    case 'pdf':
      return extractPdf(bytes)
    case 'docx':
      return [{ page: null, text: extractDocx(bytes) }]
    default:
      return [{ page: null, text: new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '') }]
  }
}
