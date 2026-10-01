import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import * as routes from '@/app/routes'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
import { AppLayout } from './AppLayout'

function Boom(): never {
  throw new Error('kaboom')
}

function renderApp(url: string) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { path: '/', element: <p>home</p>, handle: { title: 'Satellite eyes for every farm' } },
          { path: '/data', element: <p>data</p>, handle: { title: 'NASA data' } },
          { path: '/broken', element: <Boom /> },
        ],
      },
    ],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('AppLayout', () => {
  it('names the browser tab after the page', async () => {
    const router = renderApp('/')
    await waitFor(() => expect(document.title).toBe('Satellite eyes for every farm · FarmShield AI'))
    await router.navigate('/data')
    await waitFor(() => expect(document.title).toBe('NASA data · FarmShield AI'))
  })

  it('keeps developer pages out of the farmer navigation', () => {
    renderApp('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toHaveTextContent('Assistant')
    expect(nav).not.toHaveTextContent('Design')
    expect(screen.getByRole('link', { name: 'Design system' })).toHaveAttribute('href', '/design')
  })

  it('starts loading a page when its link is hovered', async () => {
    const prefetch = vi.spyOn(routes, 'prefetchPage').mockImplementation(() => {})
    renderApp('/')
    await userEvent.hover(screen.getByRole('link', { name: 'Map' }))
    expect(prefetch).toHaveBeenCalledWith('/map')
  })

  it('shows a friendly page instead of a crash', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderApp('/broken')
    expect(screen.getByRole('heading', { name: 'We lost the signal for a moment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })
})
