import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Feature routes (dashboard, map, assistant, ...) are added here as each prompt lands.
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'dashboard',
        lazy: async () => ({ Component: (await import('@/pages/DashboardPage')).DashboardPage }),
      },
      {
        path: 'map',
        lazy: async () => ({ Component: (await import('@/pages/MapPage')).MapPage }),
      },
      {
        path: 'data',
        lazy: async () => ({ Component: (await import('@/pages/DataPage')).DataPage }),
      },
      {
        path: 'design',
        // Showcase is code-split so it never weighs down the farmer-facing bundle.
        lazy: async () => ({ Component: (await import('@/pages/DesignSystemPage')).DesignSystemPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
