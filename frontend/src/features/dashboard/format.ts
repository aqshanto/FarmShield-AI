// Small, farmer-friendly formatters for the dashboard, in English or Bengali.
import { type Lang, numberLocale } from '@/lib/i18n'

const GREETINGS: Record<Lang, [string, string, string]> = {
  en: ['Good morning', 'Good afternoon', 'Good evening'],
  bn: ['শুভ সকাল', 'শুভ দুপুর', 'শুভ সন্ধ্যা'],
}

export function greeting(lang: Lang = 'en', now = new Date()) {
  const hour = now.getHours()
  return GREETINGS[lang][hour < 12 ? 0 : hour < 17 ? 1 : 2]
}

export function timeAgo(iso: string, lang: Lang = 'en', now = new Date()) {
  const relative = new Intl.RelativeTimeFormat(numberLocale[lang], { numeric: 'auto' })
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

export function dayName(isoDate: string, index: number, lang: Lang = 'en') {
  if (index === 0) return lang === 'bn' ? 'আজ' : 'Today'
  return parseLocalDate(isoDate).toLocaleDateString(numberLocale[lang], { weekday: 'short' })
}
