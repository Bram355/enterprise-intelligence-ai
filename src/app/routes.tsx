import type { RouteObject } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AdminPage } from '../features/admin/AdminPage'
import { AssistantPage } from '../features/assistant/AssistantPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { RequireAuth, RequirePermission } from '../features/auth/guards'
import { LoginPage } from '../features/auth/LoginPage'
import { SetPasswordPage } from '../features/auth/SetPasswordPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { DocumentDetailPage } from '../features/library/DocumentDetailPage'
import { LibraryPage } from '../features/library/LibraryPage'
import { UploadDocumentPage } from '../features/library/UploadDocumentPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { SupportPage } from '../features/support/SupportPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <SetPasswordPage mode="reset" /> },
  { path: '/accept-invite', element: <SetPasswordPage mode="invite" /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'assistant/:conversationId?', element: <AssistantPage /> },
      { path: 'library', element: <LibraryPage /> },
      {
        path: 'library/upload',
        element: (
          <RequirePermission permission="documents.manage">
            <UploadDocumentPage />
          </RequirePermission>
        ),
      },
      { path: 'library/:id', element: <DocumentDetailPage /> },
      { path: 'support/:caseId?', element: <SupportPage /> },
      {
        path: 'admin',
        element: (
          <RequirePermission permission="admin.view">
            <AdminPage />
          </RequirePermission>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
