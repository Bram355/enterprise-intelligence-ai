import { Badge, type BadgeTone } from '../../components/ui/Badge'
import type { DocumentStatus } from '../../services/documents'

const TONES: Record<DocumentStatus, BadgeTone> = { uploaded: 'neutral', processing: 'info', indexed: 'success', failed: 'danger' }
const LABELS: Record<DocumentStatus, string> = { uploaded: 'Uploaded', processing: 'Processing', indexed: 'Indexed', failed: 'Failed' }

export function StatusBadge({ status, archived }: { status: DocumentStatus; archived?: boolean }) {
  if (archived) return <Badge tone="neutral">Archived</Badge>
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>
}
