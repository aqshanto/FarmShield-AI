import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeDashboard } from '@/test/fixtures'
import type { RiskModuleSummary } from '@/types/api'
import { ActionBanner, ActionPill } from './ActionBanner'
import { RiskCard } from './RiskCard'
import { RiskDetailPanel } from './RiskDetailPanel'

const hold = { kind: 'hold' as const, title: 'Hold off: rain is coming', detail: 'About 27 mm of rain is expected in the next 3 days.' }

const liveWater: RiskModuleSummary = {
  ...makeDashboard().modules[1],
  data_source: 'live',
  status: 'Getting dry',
  action: hold,
}

describe('irrigation action', () => {
  it('pill shows the decision; banner adds the reasoning', () => {
    render(
      <>
        <ActionPill action={hold} />
        <ActionBanner action={hold} />
      </>,
    )
    expect(screen.getAllByText('Hold off: rain is coming')).toHaveLength(2)
    const banner = screen.getByRole('note', { name: 'What to do now' })
    expect(banner).toHaveTextContent('About 27 mm of rain is expected')
  })

  it('appears on the live risk card and in its detail panel with the status', () => {
    render(<RiskCard module={liveWater} selected={false} onSelect={() => {}} />)
    expect(screen.getByText('Hold off: rain is coming')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()

    render(<RiskDetailPanel module={liveWater} onClose={() => {}} />)
    expect(screen.getByText('Status: Getting dry')).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'What to do now' })).toBeInTheDocument()
  })

  it('demo modules show no action and a Demo marker', () => {
    render(<RiskCard module={makeDashboard().modules[1]} selected={false} onSelect={() => {}} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByText('Demo')).toBeInTheDocument()
  })
})
