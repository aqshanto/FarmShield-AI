import type { Lang } from '@/lib/i18n'
import type { RiskModule } from '@/types/api'

// Every word the assistant screen shows, in both languages.
export const strings = {
  en: {
    title: 'Ask FarmShield',
    subtitle: 'Your farm helper. Ask about water, floods, crop health or the weather.',
    greeting: (farm: string) => `Hello! I'm FarmShield. I'm watching ${farm} from space today. What would you like to know?`,
    language: 'Language',
    farm: 'Farm',
    addFarm: 'Add my farm',
    lookingAt: 'Looking at',
    openDashboard: 'Open dashboard',
    placeholder: 'Type your question…',
    listening: 'Listening… speak now',
    send: 'Send question',
    stop: 'Stop answer',
    micStart: 'Ask by voice',
    micStop: 'Stop listening',
    listen: 'Read aloud',
    stopListen: 'Stop reading',
    noVoice: (reply: Lang) => (reply === 'bn' ? 'This device has no Bengali voice' : 'This device has no English voice'),
    newChat: 'New chat',
    thinking: 'FarmShield is thinking',
    you: 'You',
    assistant: 'FarmShield',
    engineClaude: 'Claude AI',
    engineOffline: 'Built-in helper',
    engineClaudeHint: 'Answers written by Claude from your farm’s NASA data.',
    engineOfflineHint: 'Quick answers from your farm’s NASA data.',
    quickAnswer: 'Quick answer',
    error: 'Sorry, I couldn’t reach the farm brain. Check your connection and try again.',
    suggestions: 'Try asking',
    disclaimer: 'Based on NASA satellite data for your field. For medicines and doses, ask your Upazila agriculture office or call 16123.',
  },
  bn: {
    title: 'ফার্মশিল্ডকে জিজ্ঞেস করুন',
    subtitle: 'আপনার খামারের সাহায্যকারী। সেচ, বন্যা, ফসলের স্বাস্থ্য বা আবহাওয়া নিয়ে প্রশ্ন করুন।',
    greeting: (farm: string) => `আসসালামু আলাইকুম! আমি ফার্মশিল্ড। আজ মহাকাশ থেকে ${farm} দেখছি। কী জানতে চান?`,
    language: 'ভাষা',
    farm: 'খামার',
    addFarm: 'আমার জমি যোগ করুন',
    lookingAt: 'দেখছি',
    openDashboard: 'ড্যাশবোর্ড খুলুন',
    placeholder: 'আপনার প্রশ্ন লিখুন…',
    listening: 'শুনছি… এখন বলুন',
    send: 'প্রশ্ন পাঠান',
    stop: 'উত্তর থামান',
    micStart: 'মুখে বলে জিজ্ঞেস করুন',
    micStop: 'শোনা বন্ধ করুন',
    listen: 'শুনুন',
    stopListen: 'পড়া থামান',
    noVoice: (reply: Lang) => (reply === 'bn' ? 'এই ডিভাইসে বাংলা কণ্ঠ নেই' : 'এই ডিভাইসে ইংরেজি কণ্ঠ নেই'),
    newChat: 'নতুন আলাপ',
    thinking: 'ফার্মশিল্ড ভাবছে',
    you: 'আপনি',
    assistant: 'ফার্মশিল্ড',
    engineClaude: 'Claude AI',
    engineOffline: 'নিজস্ব সাহায্যকারী',
    engineClaudeHint: 'আপনার খামারের নাসা তথ্য থেকে Claude উত্তর লিখছে।',
    engineOfflineHint: 'আপনার খামারের নাসা তথ্য থেকে দ্রুত উত্তর।',
    quickAnswer: 'দ্রুত উত্তর',
    error: 'দুঃখিত, এখন উত্তর আনতে পারছি না। সংযোগ দেখে আবার চেষ্টা করুন।',
    suggestions: 'এগুলো জিজ্ঞেস করতে পারেন',
    disclaimer: 'আপনার জমির নাসা উপগ্রহ তথ্যের ভিত্তিতে। ওষুধ ও মাত্রার জন্য উপজেলা কৃষি অফিস বা ১৬১২৩ নম্বরে ফোন করুন।',
  },
} satisfies Record<Lang, Record<string, string | ((arg: never) => string)>>

type Suggestion = { module: RiskModule | 'weather' | 'today'; text: string }

const suggestionList: Record<Lang, Suggestion[]> = {
  en: [
    { module: 'today', text: 'What should I do today?' },
    { module: 'water_stress', text: 'Should I irrigate today?' },
    { module: 'flood_risk', text: 'Is there flood danger this week?' },
    { module: 'crop_health', text: 'Is my crop healthy?' },
    { module: 'weather', text: 'Will it rain this week?' },
  ],
  bn: [
    { module: 'today', text: 'আজ কী করব?' },
    { module: 'water_stress', text: 'আজ কি সেচ দেব?' },
    { module: 'flood_risk', text: 'এই সপ্তাহে কি বন্যার ভয় আছে?' },
    { module: 'crop_health', text: 'আমার ফসল কেমন আছে?' },
    { module: 'weather', text: 'এই সপ্তাহে কি বৃষ্টি হবে?' },
  ],
}

/** Suggested questions, the farm's most pressing risk first. */
export function suggestionsFor(lang: Lang, worst?: RiskModule): string[] {
  const list = suggestionList[lang]
  const first = list.filter((s) => s.module === 'today' || s.module === worst)
  return [...first, ...list.filter((s) => !first.includes(s))].map((s) => s.text)
}
