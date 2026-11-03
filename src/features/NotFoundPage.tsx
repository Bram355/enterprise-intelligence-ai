import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="The page you requested does not exist." />
      <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        Back to dashboard
      </Link>
    </>
  )
}
