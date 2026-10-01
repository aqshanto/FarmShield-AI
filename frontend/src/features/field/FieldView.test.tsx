import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RiskDetailPanel } from '@/features/dashboard/RiskDetailPanel'
import { makeDashboard } from '@/test/fixtures'
import { FieldView } from './FieldView'

// Fixture farm: Haor, Boro rice. Flood 78 (danger), water 12 (safe), crop 30 (watch).
// The scene is the SVG; the stage meters are images too, so pick it by its data attribute.
const scene = () => document.querySelector('svg[data-water]') as SVGSVGElement

beforeEach(() => {
  localStorage.clear()
  // Exit animations finish instantly, so removed elements leave the DOM right away.
  MotionGlobalConfig.skipAnimations = true
})
afterEach(() => {
  MotionGlobalConfig.skipAnimations = false
  vi.useRealTimers()
})

describe('FieldView', () => {
  it('pictures every risk with its stage, and warns at the danger stage', () => {
    render(<FieldView dashboard={makeDashboard()} />)
    expect(screen.getByRole('heading', { name: 'My field today' })).toBeInTheDocument()
    expect(scene()).toHaveAccessibleName('Flood: Plants under water. Water: Moist soil. Crop: Some yellow leaves')
    expect(screen.getByRole('img', { name: 'Flood: Plants under water, Stage 4 of 4' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Crop: Some yellow leaves, Stage 2 of 4' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could be damaged. Act today.')
    // Floodwater is drawn over the rice
    expect(Number(scene().getAttribute('data-water'))).toBeGreaterThan(0.9)
    // Today's forecast brings heavy rain (fixture: 96 mm on day 3)
    expect(screen.getByText('Rain on the way')).toBeInTheDocument()
  })

  it('focuses on one risk at a time', async () => {
    render(<FieldView dashboard={makeDashboard()} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Water' }))
    expect(scene()).toHaveAccessibleName('Water: Moist soil')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Without the flood, the rice keeps only its normal paddy water
    expect(Number(scene().getAttribute('data-water'))).toBeLessThan(0.2)
  })

  it('speaks Bengali and remembers the choice', async () => {
    render(<FieldView dashboard={makeDashboard()} />)
    await userEvent.click(screen.getByRole('radio', { name: 'বাংলা' }))
    expect(screen.getByRole('heading', { name: 'আজ আমার জমি' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'বন্যা: গাছ পানির নিচে, ধাপ ৪ / ৪' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('ক্ষতি হতে পারে। আজই ব্যবস্থা নিন।')
    expect(localStorage.getItem('farmshield-lang')).toBe('bn')
  })

  it('replays the last two weeks from the risk trend', async () => {
    render(<FieldView dashboard={makeDashboard()} />)

    // Scrub back to the first day: flood was only 22 (safe) then.
    fireEvent.change(screen.getByRole('slider', { name: 'Day' }), { target: { value: '0' } })
    expect(screen.getAllByText('13 days ago')).toHaveLength(2) // picture badge and slider value
    expect(screen.getByRole('img', { name: 'Flood: Normal paddy water, Stage 1 of 4' })).toBeInTheDocument()
    // Today's extras (forecast rain) stay out of the past
    await waitFor(() => expect(screen.queryByText('Rain on the way')).not.toBeInTheDocument())

    // Play through to today on a fake clock (700 ms per day).
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Play last 2 weeks' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    // Each day is scheduled after the previous one renders, so step one day at a time.
    for (let day = 0; day < 14; day++) {
      act(() => {
        vi.advanceTimersByTime(700)
      })
    }
    expect(screen.getByRole('img', { name: 'Flood: Plants under water, Stage 4 of 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play last 2 weeks' })).toBeInTheDocument()
    expect(screen.getAllByText('Today')).toHaveLength(1) // slider back on today, no "days ago" badge
  })
})

describe('RiskDetailPanel stage', () => {
  it('shows the field stage for the risk, worded for the crop', () => {
    const flood = makeDashboard().modules[0]
    render(<RiskDetailPanel module={flood} crop="Boro rice" onClose={() => {}} />)
    expect(screen.getByRole('img', { name: 'Flood: Plants under water, Stage 4 of 4' })).toBeInTheDocument()
  })
})
