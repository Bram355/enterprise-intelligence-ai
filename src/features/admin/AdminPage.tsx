import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'

export function AdminPage() {
  return (
    <>
      <PageHeader title="Administration" description="Manage people, permissions and the knowledge lifecycle." />
      <PlannedFeature
        phase={7}
        summary="Administrative tools, with every permission enforced by the database rather than only hidden in the interface."
        capabilities={[
          'User and role management',
          'Departments and categories',
          'Document access control',
          'Processing monitor',
          'Feedback review',
          'Audit logs',
        ]}
      />
    </>
  )
}
