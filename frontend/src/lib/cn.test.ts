import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('lets later classes win within the same group', () => {
    expect(cn('text-ink', 'text-ink-muted')).toBe('text-ink-muted')
    expect(cn('p-5', 'p-8')).toBe('p-8')
  })

  it('keeps custom size and gradient utilities alongside text colors', () => {
    expect(cn('text-display', 'text-ink')).toBe('text-display text-ink')
    expect(cn('text-gradient-brand', 'text-4xl')).toBe('text-gradient-brand text-4xl')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })
})
