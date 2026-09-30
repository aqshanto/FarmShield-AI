// Small, farmer-friendly formatters for the dashboard.

export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso: string, now = new Date()) {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

// Parses YYYY-MM-DD as a local calendar date (not UTC midnight, which can shift the day).
export function parseLocalDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dayName(isoDate: string, index: number) {
  if (index === 0) return 'Today'
  return parseLocalDate(isoDate).toLocaleDateString('en', { weekday: 'short' })
}
