import { MotionConfig } from 'framer-motion'
import { RouterProvider } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { router } from './router'

export function App() {
  return (
    // Respect the user's OS "reduce motion" setting across all animations.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </MotionConfig>
  )
}
