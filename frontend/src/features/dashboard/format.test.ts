import { describe, expect, it } from 'vitest'
import { dayName, greeting, parseLocalDate, timeAgo } from './format'

describe('dashboard formatters', () => {
  it('greets by time of day', () => {
    expect(greeting('en', new Date(2026, 3, 10, 7))).toBe('Good morning')
    expect(greeting('en', new Date(2026, 3, 10, 14))).toBe('Good afternoon')
    expect(greeting('en', new Date(2026, 3, 10, 20))).toBe('Good evening')
    expect(greeting('bn', new Date(2026, 3, 10, 7))).toBe('শুভ সকাল')
  })

  it('describes how long ago the satellite passed', () => {
    const now = new Date('2026-04-10T12:00:00Z')
    expect(timeAgo('2026-04-10T10:00:00Z', 'en', now)).toBe('2 hours ago')
    expect(timeAgo('2026-04-10T11:45:00Z', 'en', now)).toBe('15 minutes ago')
    expect(timeAgo('2026-04-08T12:00:00Z', 'en', now)).toBe('2 days ago')
    expect(timeAgo('2026-04-10T10:00:00Z', 'bn', now)).toBe('২ ঘণ্টা আগে')
  })

  it('parses calendar dates in local time (no UTC day shift)', () => {
    const d = parseLocalDate('2026-04-10')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 3, 10])
  })

  it('labels the first forecast day "Today" and others by weekday', () => {
    expect(dayName('2026-04-10', 0)).toBe('Today')
    expect(dayName('2026-04-11', 1)).toBe('Sat') // 11 April 2026 is a Saturday
  })
})
