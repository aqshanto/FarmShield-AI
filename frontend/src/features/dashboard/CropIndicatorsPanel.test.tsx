import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CropIndicators } from '@/types/api'
import { CropIndicatorsPanel } from './CropIndicatorsPanel'

const base: CropIndicators = {
  crop: 'potato',
  greenness: 0.72,
  greenness_normal: 0.66,
  last_clear_view: '2026-09-20',
  cloud_gap_days: 11,
  heat_days: 10,
  heat_limit_c: 29,
  disease: 'late blight',
  disease_days: 3,
}

describe('CropIndicatorsPanel', () => {
  it('shows greenness against normal, the last clear view, heat and disease days', () => {
    render(<CropIndicatorsPanel indicators={base} />)
    expect(screen.getByRole('meter', { name: 'Greenness compared with normal' })).toHaveAttribute('aria-valuetext', '0.72, 109% of the normal 0.66')
    expect(screen.getByText(/^On (Sep 20|20 Sept?)$/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '10 of 10 days above 29°C' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 of 8 days suit late blight' })).toBeInTheDocument()
  })

  it('flags an old view and asks for a field walk', () => {
    render(<CropIndicatorsPanel indicators={{ ...base, last_clear_view: '2026-06-10', cloud_gap_days: 113 }} />)
    expect(screen.getByText(/^Clouds since (Jun 10|10 Jun)\. Walk the field to check\.$/)).toBeInTheDocument()
  })

  it('says the field was under water instead of showing a meaningless greenness', () => {
    render(<CropIndicatorsPanel indicators={{ ...base, greenness: -0.14, last_clear_view: '2026-08-05', cloud_gap_days: 57 }} />)
    expect(screen.getByText(/showed water on the field/)).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })
})
