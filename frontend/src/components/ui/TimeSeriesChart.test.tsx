import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { type ChartSeries, TimeSeriesChart } from './TimeSeriesChart'

const rain: ChartSeries = {
  id: 'rain',
  label: 'Rainfall',
  color: 'blue',
  kind: 'bar',
  points: [
    { date: '2026-09-01', value: 12 },
    { date: '2026-09-05', value: 30 },
  ],
}
const root: ChartSeries = { id: 'root', label: 'Root zone', color: 'orange', kind: 'line', points: [{ date: '2026-09-05', value: 20 }] }

function renderChart(series: ChartSeries[]) {
  return render(
    <TimeSeriesChart
      series={series}
      start="2026-09-01"
      end="2026-09-10"
      yDomain={[0, 50]}
      yTicks={[0, 25, 50]}
      formatValue={(v) => `${v}`}
      label="Rain chart"
      summary="Daily rain."
    />,
  )
}

describe('TimeSeriesChart', () => {
  it('needs no legend for a single series', () => {
    renderChart([rain])
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Rain chart' })).toHaveAccessibleDescription(/Daily rain\./)
  })

  it('shows a legend for two or more series', () => {
    renderChart([rain, root])
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(legend).toHaveTextContent('Rainfall')
    expect(legend).toHaveTextContent('Root zone')
  })

  it('reads days with data using the arrow keys', async () => {
    renderChart([rain, root])
    await userEvent.tab()
    expect(screen.getByText('Sep 5: Rainfall 30, Root zone 20')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    // Snaps to the previous day that has data, not to empty days.
    expect(screen.getByText('Sep 1: Rainfall 12, Root zone no reading')).toBeInTheDocument()
  })

  it('shows a friendly message when there is no data', () => {
    render(
      <TimeSeriesChart
        series={[{ ...rain, points: [] }]}
        start="2026-09-01"
        end="2026-09-10"
        yDomain={[0, 50]}
        yTicks={[0, 50]}
        formatValue={String}
        label="Empty"
        summary="Nothing."
        emptyMessage="Clouds have hidden this field."
      />,
    )
    expect(screen.getByText('Clouds have hidden this field.')).toBeInTheDocument()
  })
})
