import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AnimatedNumber } from './AnimatedNumber'
import { Button } from './Button'
import { RiskBadge } from './RiskBadge'
import { ScoreRing } from './ScoreRing'
import { SegmentedControl } from './SegmentedControl'
import { Slider } from './Slider'

describe('Button', () => {
  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is busy and not clickable while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: /save/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ScoreRing', () => {
  it('exposes the score as an accessible meter', () => {
    render(<ScoreRing score={82} label="Flood risk" />)
    const meter = screen.getByRole('meter', { name: 'Flood risk' })
    expect(meter).toHaveAttribute('aria-valuenow', '82')
    expect(meter).toHaveAttribute('aria-valuetext', '82 out of 100, Danger')
  })

  it('clamps scores into 0–100', () => {
    render(<ScoreRing score={140} label="Risk" />)
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('RiskBadge', () => {
  it('shows the label in the chosen language', () => {
    const { rerender } = render(<RiskBadge level="danger" />)
    expect(screen.getByText('Danger')).toBeInTheDocument()
    rerender(<RiskBadge level="safe" lang="bn" />)
    expect(screen.getByText('নিরাপদ')).toHaveAttribute('lang', 'bn')
  })
})

describe('AnimatedNumber', () => {
  it('announces the final formatted value to screen readers', () => {
    render(<AnimatedNumber value={1234} suffix=" mm" />)
    expect(screen.getByText('1,234 mm')).toHaveClass('sr-only')
  })

  it('uses Bengali numerals for bn-BD', () => {
    render(<AnimatedNumber value={45} suffix="%" locale="bn-BD" />)
    expect(screen.getByText('৪৫%')).toBeInTheDocument()
  })
})

describe('SegmentedControl', () => {
  function Harness({ onChange }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState<'en' | 'bn'>('en')
    return (
      <SegmentedControl
        ariaLabel="Language"
        value={value}
        onChange={(v) => {
          setValue(v)
          onChange?.(v)
        }}
        options={[
          { value: 'en', label: 'English' },
          { value: 'bn', label: 'বাংলা' },
        ]}
      />
    )
  }

  it('selects on click', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: 'বাংলা' }))
    expect(screen.getByRole('radio', { name: 'বাংলা' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false')
  })

  it('moves selection and focus with arrow keys, wrapping around', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'English' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'বাংলা' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'বাংলা' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true'))
  })

  it('only the selected option is in the tab order', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'বাংলা' })).toHaveAttribute('tabindex', '-1')
  })
})

describe('Slider', () => {
  it('is labelled and reports numeric changes', () => {
    const onChange = vi.fn()
    render(<Slider label="Soil moisture" value={40} onChange={onChange} valueLabel="40%" />)
    const input = screen.getByRole('slider', { name: 'Soil moisture' })
    // jsdom doesn't simulate range arrow keys, so fire the change directly.
    fireEvent.change(input, { target: { value: '41' } })
    expect(onChange).toHaveBeenCalledWith(41)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })
})
