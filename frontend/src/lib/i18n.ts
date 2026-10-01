// Language support. The farmer-facing assistant speaks English and Bengali.
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
