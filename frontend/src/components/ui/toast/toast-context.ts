import { createContext } from 'react'

export type ToastTone = 'success' | 'info' | 'warning' | 'danger'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  // Milliseconds before auto-dismiss.
  duration?: number
}

export interface ToastItem extends Required<Omit<ToastOptions, 'description'>> {
  id: number
  description?: string
}

export interface ToastApi {
  toast: (options: ToastOptions) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
