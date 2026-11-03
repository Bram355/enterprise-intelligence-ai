import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'

export function SupportPage() {
  return (
    <>
      <PageHeader title="Technical Support" description="Step-by-step troubleshooting grounded in internal documentation." />
      <PlannedFeature
        phase={6}
        summary="Guided diagnostics that identify the problem, likely causes, documentation evidence, next steps and when to escalate."
        capabilities={[
          'API integration and authentication errors',
          'HTTP error codes',
          'Payment failures',
          'POS and terminal connectivity',
          'Webhooks and callbacks',
          'SDK and plugin issues',
        ]}
      />
    </>
  )
}
