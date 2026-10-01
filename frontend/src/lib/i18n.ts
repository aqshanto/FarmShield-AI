import { useSyncExternalStore } from 'react'

// One language for the whole app (English or Bengali), chosen once and remembered.
// A tiny store rather than a React context, so any component (and any test) can read
// it without a provider. Each feature keeps its words next to it as { en, bn }.
export type Lang = 'en' | 'bn'

export const numberLocale: Record<Lang, string> = {
  en: 'en',
  bn: 'bn-BD',
}

/** BCP 47 tags for the browser's speech recognition and synthesis. */
export const speechLocale: Record<Lang, string> = {
  en: 'en-US',
  bn: 'bn-BD',
}

const LANG_KEY = 'farmshield-lang'

export function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en'
  } catch {
    return 'en'
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

// --- the app-wide language --------------------------------------------------------------

const listeners = new Set<() => void>()
let current: Lang | null = null

function getLang(): Lang {
  if (current === null) current = savedLang()
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setLang(lang: Lang) {
  if (lang === getLang()) return
  current = lang
  saveLang(lang)
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  listeners.forEach((l) => l())
}

/** The current language; re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en')
}

/** This feature's words in the current language: `const t = useText(text)`. */
export function useText<T>(dict: Record<Lang, T>): T {
  return dict[useLang()]
}

/** For tests: back to English, forgetting both the in-memory and the saved choice. */
export function resetLang() {
  current = null
  try {
    localStorage.removeItem(LANG_KEY)
  } catch {
    // Storage blocked: nothing was saved.
  }
}

// --- formatting ------------------------------------------------------------------------

export const bnDigits = (s: string | number) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])

/** Digits in the reader's script: ১২ in Bengali, 12 in English. */
export const digits = (s: string | number, lang: Lang) => (lang === 'bn' ? bnDigits(s) : String(s))

export function formatNumber(n: number, lang: Lang, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(numberLocale[lang], options).format(n)
}

/** Dates: '5 Oct' / '৫ অক্টো', or with the options given. */
export function formatDate(date: string | Date, lang: Lang, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date)
  return d.toLocaleDateString(numberLocale[lang], options)
}

const BN_VOWEL_ENDINGS = new Set('ািীুূৃেৈোৌঅআইঈউঊঋএঐওঔ')
/** Bengali possessive: বগুড়া → বগুড়ার, ধান → ধানের, রোগ → রোগের. */
export const bnOf = (word: string) =>
  /[A-Za-z0-9]$/.test(word) ? `${word}-এর` : BN_VOWEL_ENDINGS.has(word.at(-1) ?? '') ? `${word}র` : `${word}ের` // Latin-script names: Komothai-এর
