import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'

export function LibraryPage() {
  return (
    <>
      <PageHeader title="Knowledge Library" description="Central store of approved organisational documents." />
      <PlannedFeature
        phase={3}
        summary="Upload and manage PDF, Word and text documents. Each document is processed, split into sections and indexed for search."
        capabilities={[
          'Upload PDF, Word and text files',
          'Categories, departments and tags',
          'Processing status tracking',
          'Version history',
          'Archive outdated documents',
          'Department-level access control',
        ]}
      />
    </>
  )
}
