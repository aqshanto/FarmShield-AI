import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
import { pageLoaders } from './routes'

// Each route names its browser-tab title in `handle.title` (AppLayout applies it).
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage />, handle: { title: 'Satellite eyes for every farm' } },
      { path: 'dashboard', lazy: async () => ({ Component: await pageLoaders['/dashboard']() }), handle: { title: 'Farm dashboard' } },
      { path: 'map', lazy: async () => ({ Component: await pageLoaders['/map']() }), handle: { title: 'Risk map' } },
      { path: 'assistant', lazy: async () => ({ Component: await pageLoaders['/assistant']() }), handle: { title: 'Ask FarmShield' } },
      { path: 'farms/new', lazy: async () => ({ Component: await pageLoaders['/farms/new']() }), handle: { title: 'Add my farm' } },
      { path: 'data', lazy: async () => ({ Component: await pageLoaders['/data']() }), handle: { title: 'NASA data' } },
      // Showcase is code-split so it never weighs down the farmer-facing bundle.
      { path: 'design', lazy: async () => ({ Component: await pageLoaders['/design']() }), handle: { title: 'Design system' } },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Page not found' } },
    ],
  },
])
