import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
import { pageLoaders } from './routes'

// Each route names its browser-tab title in both languages in `handle.title` (AppLayout applies it).
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage />, handle: { title: { en: 'Satellite eyes for every farm', bn: 'প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ' } } },
      { path: 'dashboard', lazy: async () => ({ Component: await pageLoaders['/dashboard']() }), handle: { title: { en: 'Farm dashboard', bn: 'খামারের ড্যাশবোর্ড' } } },
      { path: 'map', lazy: async () => ({ Component: await pageLoaders['/map']() }), handle: { title: { en: 'Risk map', bn: 'ঝুঁকির মানচিত্র' } } },
      { path: 'assistant', lazy: async () => ({ Component: await pageLoaders['/assistant']() }), handle: { title: { en: 'Ask FarmShield', bn: 'ফার্মশিল্ডকে জিজ্ঞেস করুন' } } },
      { path: 'farms/new', lazy: async () => ({ Component: await pageLoaders['/farms/new']() }), handle: { title: { en: 'Add my farm', bn: 'আমার জমি যোগ করুন' } } },
      { path: 'data', lazy: async () => ({ Component: await pageLoaders['/data']() }), handle: { title: { en: 'NASA data', bn: 'নাসার তথ্য' } } },
      // Showcase is code-split so it never weighs down the farmer-facing bundle.
      { path: 'design', lazy: async () => ({ Component: await pageLoaders['/design']() }), handle: { title: { en: 'Design system', bn: 'ডিজাইন সিস্টেম' } } },
      { path: '*', element: <NotFoundPage />, handle: { title: { en: 'Page not found', bn: 'পাতা পাওয়া যায়নি' } } },
    ],
  },
])
