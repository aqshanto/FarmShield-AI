import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { DesignSystemPage } from './DesignSystemPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DesignSystemPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('DesignSystemPage', () => {
  it('renders every showcase section', () => {
    renderPage()
    for (const title of [
      'One risk language everywhere',
      'Illustrations that react to data',
      'Living numbers',
      'Buttons & feedback',
      'Loading without the wait feeling',
      'Colors with meaning',
      'Friendly, readable type',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('risk playground: moving the slider updates meter, badge and advice together', async () => {
    renderPage()
    const section = screen.getByRole('region', { name: 'One risk language everywhere' })
    const slider = within(section).getByRole('slider', { name: 'Rainfall this week' })

    fireEvent.change(slider, { target: { value: '90' } })

    expect(within(section).getByRole('meter')).toHaveAttribute('aria-valuetext', '90 out of 100, Danger')
    expect(within(section).getByText('Danger')).toBeInTheDocument()
    // The advice swaps with an exit-then-enter animation, so wait for the new sentence.
    expect(await within(section).findByText('Act today. Your crop is at risk.')).toBeInTheDocument()
  })

  it('switching to Bengali translates the risk playground', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('radio', { name: 'বাংলা' }))
    expect(screen.getByRole('heading', { name: 'বোতাম ও সাড়া' })).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'সব জায়গায় ঝুঁকির একই ভাষা' })
    expect(within(section).getByRole('meter', { name: 'বন্যার ঝুঁকি' })).toBeInTheDocument()
    expect(within(section).getByRole('slider', { name: 'এই সপ্তাহের বৃষ্টি' })).toBeInTheDocument()
  })

  it('crop illustration advice reacts to plant health', () => {
    renderPage()
    const slider = screen.getByRole('slider', { name: 'Plant health' })
    fireEvent.change(slider, { target: { value: '10' } })
    expect(screen.getByText('Your crop is struggling. Act soon.')).toBeInTheDocument()
  })
})
