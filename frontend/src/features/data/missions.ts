import type { SourceStatus } from '@/types/api'

export type MissionId = 'SMAP' | 'GPM' | 'MODIS' | 'VIIRS'

export interface MissionInfo {
  id: MissionId
  name: string
  tagline: string
  // What it tells a farmer, in plain words.
  measures: string
  // The mission's own data source, and the no-login stand-in used without a token.
  source: string
  standIn?: string
}

export const MISSIONS: MissionInfo[] = [
  {
    id: 'SMAP',
    name: 'SMAP',
    tagline: 'Soil Moisture Active Passive',
    measures: 'How wet your soil is. Its radar sees through clouds.',
    source: 'smap',
    standIn: 'nasa_power',
  },
  {
    id: 'GPM',
    name: 'GPM',
    tagline: 'Global Precipitation Measurement',
    measures: 'How much rain fell, every day, everywhere.',
    source: 'gpm_imerg',
    standIn: 'nasa_power',
  },
  {
    id: 'MODIS',
    name: 'MODIS',
    tagline: 'Terra & Aqua satellites',
    measures: 'How green and healthy your plants look.',
    source: 'modis',
  },
  {
    id: 'VIIRS',
    name: 'VIIRS',
    tagline: 'Visible Infrared Imaging Radiometer Suite',
    measures: 'What “normal” greenness looks like for this time of year.',
    source: 'viirs',
  },
]

export const SOURCE_NAMES: Record<string, string> = {
  nasa_power: 'NASA POWER',
  gpm_imerg: 'GPM IMERG',
  smap: 'SMAP',
  modis: 'MODIS',
  viirs: 'VIIRS',
}

export type MissionState = 'live' | 'stand-in' | 'approve' | 'baseline' | 'problem' | 'waiting'

export function missionState(mission: MissionInfo, sources: SourceStatus[]): MissionState {
  const own = sources.find((s) => s.id === mission.source)
  const standIn = mission.standIn ? sources.find((s) => s.id === mission.standIn) : undefined
  if (!own) return 'waiting'
  if (own.state === 'ok') return mission.id === 'VIIRS' ? 'baseline' : 'live'
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
