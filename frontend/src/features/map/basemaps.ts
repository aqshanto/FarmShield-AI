// NASA GIBS imagery used as the map background. Public WMTS tiles, no API key.
// https://nasa-gibs.github.io/gibs-api-docs/

export type BasemapId = 'relief' | 'today' | 'night'

export interface Basemap {
  id: BasemapId
  label: string
  labelBn: string
  description: string
  descriptionBn: string
  tiles: string
  maxzoom: number
}

import { formatDate } from '@/lib/i18n'

export const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

// Yesterday (UTC): today's global mosaic is still being filled in during the day.
export function modisDate(now = new Date()) {
  return new Date(now.getTime() - 24 * 3_600_000).toISOString().slice(0, 10)
}

export function basemaps(now = new Date()): Basemap[] {
  return [
    {
      id: 'relief',
      label: 'Relief',
      labelBn: 'ভূমিরূপ',
      description: 'NASA Blue Marble: land, rivers and terrain',
      descriptionBn: 'নাসার ব্লু মার্বেল: ভূমি, নদী আর ভূপ্রকৃতি',
      tiles: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
      maxzoom: 8,
    },
    {
      id: 'today',
      label: 'Yesterday',
      labelBn: 'গতকাল',
      description: `MODIS Terra true-colour image from ${modisDate(now)}, clouds included`,
      descriptionBn: `${formatDate(modisDate(now), 'bn', { day: 'numeric', month: 'long' })} তারিখের MODIS Terra আসল রঙের ছবি, মেঘসহ`,
      tiles: `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${modisDate(now)}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      maxzoom: 9,
    },
    {
      id: 'night',
      label: 'Night',
      labelBn: 'রাত',
      description: 'VIIRS Black Marble: city lights at night',
      descriptionBn: 'VIIRS ব্ল্যাক মার্বেল: রাতের শহরের আলো',
      tiles: `${GIBS}/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
      maxzoom: 8,
    },
  ]
}

export const ATTRIBUTION = [
  '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">NASA GIBS / EOSDIS</a>',
  '<a href="https://www.naturalearthdata.com" target="_blank" rel="noreferrer">Natural Earth</a>',
]
