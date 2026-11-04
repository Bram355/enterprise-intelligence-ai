export const MAX_FILE_BYTES = 20 * 1024 * 1024

export type FileKind = 'pdf' | 'docx' | 'text' | 'markdown'

export const MIME_TYPES: Record<FileKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  text: 'text/plain',
  markdown: 'text/markdown',
}

const EXTENSIONS: Record<string, FileKind> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'text',
  md: 'markdown',
  markdown: 'markdown',
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .slice(-120)
  return cleaned || 'document'
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b)
}

/** Checks extension, size and the file's actual contents ("magic bytes"), so a renamed file is rejected. */
export function detectFileKind(name: string, bytes: Uint8Array): { ok: true; kind: FileKind } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: 'The file is empty' }
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: 'Files must be 20 MB or smaller' }

  const ext = name.toLowerCase().split('.').pop() ?? ''
  const kind = EXTENSIONS[ext]
  if (!kind) return { ok: false, error: 'Only PDF, Word (.docx), text (.txt) and Markdown (.md) files are supported' }

  if (kind === 'pdf' && !startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { ok: false, error: 'This file is not a valid PDF' }
  }
  if (kind === 'docx' && !startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return { ok: false, error: 'This file is not a valid Word document' }
  }
  if (kind === 'text' || kind === 'markdown') {
    if (bytes.includes(0)) return { ok: false, error: 'This file is not a plain text file' }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return { ok: false, error: 'Text files must be UTF-8 encoded' }
    }
  }
  return { ok: true, kind }
}
