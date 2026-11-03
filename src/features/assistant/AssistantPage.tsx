import { PageHeader } from '../../components/ui/PageHeader'
import { PlannedFeature } from '../../components/ui/PlannedFeature'

export function AssistantPage() {
  return (
    <>
      <PageHeader title="AI Assistant" description="Ask questions and get answers backed by approved internal documents." />
      <PlannedFeature
        phase={5}
        summary="The assistant will only answer from documents you are allowed to access, and will say so when the answer is not documented."
        capabilities={[
          'Natural-language questions',
          'Answers with source citations',
          'Page and section references',
          'Clarifying questions when needed',
          'Conversation history',
          'Helpful / not helpful feedback',
        ]}
      />
    </>
  )
}
