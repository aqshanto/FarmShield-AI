import { useContext } from 'react'
import { ToastContext } from './toast-context'

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
