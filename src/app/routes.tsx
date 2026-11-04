import type { RouteObject } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AdminPage } from '../features/admin/AdminPage'
import { AssistantPage } from '../features/assistant/AssistantPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { LibraryPage } from '../features/library/LibraryPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { SupportPage } from '../features/support/SupportPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
