import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './app/routes'
import { AuthProvider } from './features/auth/AuthProvider'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
