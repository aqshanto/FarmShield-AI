import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { approvalLinks, missionState, MISSIONS } from '@/features/data/missions'
import { makeDashboard } from '@/test/fixtures'
import type { RiskModuleSummary, SourceStatus } from '@/types/api'
import { FactorBreakdown } from './FactorBreakdown'

const liveFlood: RiskModuleSummary = {
  ...makeDashboard().modules[0],
  data_source: 'live',
  confidence: 'high',
  factors: [
    { id: 'rain', label: 'Water arriving', score: 11, weight: 0.4, detail: '10 mm fell in the last 3 days', source: 'Forecast' },
    { id: 'terrain', label: 'Low-lying land', score: 100, weight: 0.2, detail: 'The field sits 8 m above sea level', source: 'SRTM' },
  ],
}

describe('FactorBreakdown', () => {
  it('lists factors, strongest contribution first, with weight, source and evidence', () => {
    render(<FactorBreakdown module={liveFlood} />)
    const meters = screen.getAllByRole('meter')
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual(['Low-lying land', 'Water arriving'])
    expect(meters[0]).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('· counts 40%')).toBeInTheDocument()
    expect(screen.getByText('SRTM')).toBeInTheDocument()
    expect(screen.getByText('The field sits 8 m above sea level.')).toBeInTheDocument()
    expect(screen.getByText('High confidence')).toBeInTheDocument()
  })

  it('renders nothing for demo modules without factors', () => {
    const { container } = render(<FactorBreakdown module={makeDashboard().modules[1]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

const source = (id: string, state: SourceStatus['state'], message: string | null = null): SourceStatus => ({
  id,
  mission: id === 'gpm_imerg' ? 'GPM' : 'POWER',
  provider: '',
  product: '',
  variables: [],
  requires_token: true,
  note: '',
  state,
  message,
  last_success: null,
  observations: 0,
  rejected: 0,
})

describe('Earthdata approval state', () => {
  const gpm = MISSIONS.find((m) => m.id === 'GPM')!
  const url = 'https://urs.earthdata.nasa.gov/approve_app?client_id=abc'
  const sources = [source('gpm_imerg', 'needs_approval', `Approve the NASA GESDISC DATA ARCHIVE application in Earthdata Login · ${url}`), source('nasa_power', 'ok')]

  it('marks the mission as needing approval', () => {
    expect(missionState(gpm, sources)).toBe('approve')
  })

  it('extracts the approval link from the source message', () => {
    expect(approvalLinks(sources)).toEqual([{ mission: 'GPM', url }])
    expect(approvalLinks([source('nasa_power', 'ok')])).toEqual([])
  })
})
