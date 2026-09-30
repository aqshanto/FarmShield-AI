import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function Trigger({ duration = 60_000 }: { duration?: number }) {
  const { toast } = useToast()
  return (
    <>
      <button type="button" onClick={() => toast({ tone: 'success', title: 'Reminder saved', duration })}>
        notify
      </button>
      <button type="button" onClick={() => toast({ tone: 'danger', title: 'Flood alert', duration })}>
        alert
      </button>
    </>
  )
}

describe('Toasts', () => {
  it('shows a toast and removes it when dismissed', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'notify' }))
    expect(screen.getByText('Reminder saved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    await waitFor(() => expect(screen.queryByText('Reminder saved')).not.toBeInTheDocument())
  })

  it('auto-dismisses after its duration', async () => {
    render(
      <ToastProvider>
        <Trigger duration={50} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'notify' }))
    expect(screen.getByText('Reminder saved')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Reminder saved')).not.toBeInTheDocument())
  })

  it('announces danger toasts assertively as alerts', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'alert' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Flood alert')
  })

  it('throws a helpful error outside the provider', () => {
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)
  })
})
