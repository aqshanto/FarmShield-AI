import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TrendChart } from './TrendChart'

const values = [22, 24, 23, 27, 30, 29, 34, 38, 45, 51, 58, 64, 71, 78]

describe('TrendChart', () => {
  it('is a labelled, focusable group with a text summary', () => {
    render(<TrendChart values={values} color="red" label="Flood risk, last 14 days" />)
    const chart = screen.getByRole('group', { name: 'Flood risk, last 14 days' })
    expect(chart).toHaveAttribute('tabindex', '0')
    expect(chart).toHaveAccessibleDescription(/22 two weeks ago, 34 a week ago, 78 today/)
  })

  it('direct-labels only the latest value', () => {
    render(<TrendChart values={values} color="red" label="Risk" />)
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.queryByText('45')).not.toBeInTheDocument()
  })

  it('reads each day with the arrow keys', async () => {
    render(<TrendChart values={values} color="red" label="Risk" />)
    await userEvent.tab()
    expect(screen.getByText('Today: 78')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText('Yesterday: 71')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByText('3 days ago: 58')).toBeInTheDocument()
  })
})
