import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setLang } from '@/lib/i18n'
import { makeDashboard } from '@/test/fixtures'
import { ForecastStrip } from './ForecastStrip'

describe('ForecastStrip', () => {
  it('shows the week with the total rain', () => {
    const { forecast } = makeDashboard()
    render(<ForecastStrip forecast={forecast} />)
    expect(screen.getByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(forecast.length)
  })

  it('explains calmly when the forecast is missing', () => {
    render(<ForecastStrip forecast={[]} />)
    expect(screen.getByText(/forecast isn’t available right now/)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('says it in Bengali too', () => {
    setLang('bn')
    render(<ForecastStrip forecast={[]} />)
    expect(screen.getByRole('heading', { name: 'সামনের ৭ দিন' })).toBeInTheDocument()
    expect(screen.getByText(/পূর্বাভাস পাওয়া যাচ্ছে না/)).toBeInTheDocument()
  })
})
