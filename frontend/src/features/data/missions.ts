import type { SourceStatus } from '@/types/api'

export type MissionId = 'SMAP' | 'GPM' | 'MODIS' | 'VIIRS' | 'GRACE'

export type MissionState = 'live' | 'baseline' | 'long-term' | 'stand-in' | 'token' | 'approve' | 'problem' | 'waiting'

export interface MissionInfo {
  id: MissionId
  name: string
  tagline: string
  // What it tells a farmer, in plain words.
  measures: string
  taglineBn: string
  measuresBn: string
  // The mission's own data source, and the no-login stand-in used without a token.
  source: string
  standIn?: string
  // How its data is used when it isn't today's reading (default: live).
  okState?: MissionState
}

export const MISSIONS: MissionInfo[] = [
  {
    id: 'SMAP',
    name: 'SMAP',
    tagline: 'Soil Moisture Active Passive',
    measures: 'How wet your soil is. Its radar sees through clouds.',
    taglineBn: 'মাটির আর্দ্রতা মাপার স্যাটেলাইট',
    measuresBn: 'আপনার মাটি কতটা ভেজা। এর রাডার মেঘ ভেদ করে দেখে।',
    source: 'smap',
    standIn: 'nasa_power',
  },
  {
    id: 'GPM',
    name: 'GPM',
    tagline: 'Global Precipitation Measurement',
    measures: 'How much rain fell, every day, everywhere.',
    taglineBn: 'বিশ্বজুড়ে বৃষ্টি মাপার মিশন',
    measuresBn: 'কতটা বৃষ্টি হয়েছে, প্রতিদিন, সব জায়গায়।',
    source: 'gpm_imerg',
    standIn: 'nasa_power',
  },
  {
    id: 'MODIS',
    name: 'MODIS',
    tagline: 'Terra & Aqua satellites',
    measures: 'How green and healthy your plants look.',
    taglineBn: 'টেরা ও অ্যাকোয়া স্যাটেলাইট',
    measuresBn: 'আপনার গাছ কতটা সবুজ ও সুস্থ দেখাচ্ছে।',
    source: 'modis',
  },
  {
    id: 'VIIRS',
    name: 'VIIRS',
    tagline: 'Visible Infrared Imaging Radiometer Suite',
    measures: 'What “normal” greenness looks like for this time of year.',
    taglineBn: 'দিন-রাতের ইনফ্রারেড ছবি তোলার যন্ত্র',
    measuresBn: 'বছরের এই সময়ে “স্বাভাবিক” সবুজ ভাব কেমন।',
    source: 'viirs',
    okState: 'baseline',
  },
  {
    id: 'GRACE',
    name: 'GRACE',
    tagline: 'Gravity Recovery and Climate Experiment',
    measures: 'How much water is left under the ground, year after year. It sees a wide area, not one field.',
    taglineBn: 'মাটির নিচের পানি মাপার মিশন',
    measuresBn: 'বছরের পর বছর মাটির নিচে কতটা পানি থাকছে। এটি একটি জমি নয়, বড় এলাকা দেখে।',
    source: 'grace',
    okState: 'long-term',
  },
]

export const SOURCE_NAMES: Record<string, string> = {
  nasa_power: 'NASA POWER',
  gpm_imerg: 'GPM IMERG',
  smap: 'SMAP',
  modis: 'MODIS',
  viirs: 'VIIRS',
  grace: 'GRACE',
}

export function missionState(mission: MissionInfo, sources: SourceStatus[]): MissionState {
  const own = sources.find((s) => s.id === mission.source)
  const standIn = mission.standIn ? sources.find((s) => s.id === mission.standIn) : undefined
  if (!own) return 'waiting'
  if (own.state === 'ok') return mission.okState ?? 'live'
  if (own.state === 'needs_token' && !mission.standIn) return 'token'
  if (own.state === 'needs_token') return standIn?.state === 'ok' ? 'stand-in' : standIn?.state === 'error' ? 'problem' : 'waiting'
  if (own.state === 'needs_approval') return 'approve'
  if (own.state === 'error') return 'problem'
  return 'waiting'
}

// Sources that need a one-time "approve application" click in Earthdata Login, with the link.
export function approvalLinks(sources: SourceStatus[]): { mission: string; url: string }[] {
  return sources
    .filter((s) => s.state === 'needs_approval' && s.message)
    .map((s) => ({ mission: s.mission, url: s.message!.match(/https?:\/\/\S+/)?.[0] ?? 'https://urs.earthdata.nasa.gov/profile' }))
}
