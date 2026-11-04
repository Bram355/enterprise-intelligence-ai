export interface TextSegment {
  page: number | null
  text: string
}

export interface Chunk {
  index: number
  page: number | null
  content: string
}

export interface ChunkOptions {
  maxChars?: number
  overlapChars?: number
}

export function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitLong(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph]
  const sentences = paragraph.match(/[^.!?\n]+[.!?]*\s*/g) ?? [paragraph]
  const parts: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) parts.push(current.trim())
      current = ''
      for (let i = 0; i < sentence.length; i += maxChars) parts.push(sentence.slice(i, i + maxChars).trim())
      continue
    }
    if ((current + sentence).length > maxChars) {
      parts.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean)
}

function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return ''
  const tail = text.slice(-overlapChars)
  const space = tail.indexOf(' ')
  return space >= 0 ? tail.slice(space + 1) : tail
}

/**
 * Splits text into passages of roughly maxChars, keeping paragraphs together where possible
 * and repeating a little text between neighbouring chunks so context isn't lost at the edges.
 * Chunks never span pages, so each one can be cited with its page number.
 */
export function chunkSegments(segments: TextSegment[], options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? 1200
  const overlapChars = Math.min(options.overlapChars ?? 150, Math.floor(maxChars / 3))
  const chunks: Chunk[] = []

  for (const segment of segments) {
    const paragraphs = normaliseText(segment.text)
      .split(/\n\s*\n/)
      .flatMap((p) => splitLong(p.trim(), maxChars - overlapChars))
      .filter(Boolean)

    let current = ''
    const flush = () => {
      if (!current.trim()) return
      chunks.push({ index: chunks.length, page: segment.page, content: current.trim() })
      current = overlapTail(current.trim(), overlapChars)
    }

    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph
      if (candidate.length > maxChars && current) {
        const before = chunks.length
        flush()
        current = current ? `${current}\n\n${paragraph}` : paragraph
        if (chunks.length === before) current = paragraph
      } else {
        current = candidate
      }
    }
    if (current.trim() && (chunks.length === 0 || !chunks[chunks.length - 1].content.endsWith(current.trim()))) {
      chunks.push({ index: chunks.length, page: segment.page, content: current.trim() })
    }
  }
  return chunks
}
