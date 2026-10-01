// Divisional headquarters of Bangladesh: map labels, "jump to" shortcuts and
// "near …" descriptions for picked locations.
export interface Place {
  name: string
  nameBn: string
  lat: number
  lon: number
}

export const placeName = (place: Place, lang: 'en' | 'bn') => (lang === 'bn' ? place.nameBn : place.name)

export const DIVISIONS: Place[] = [
  { name: 'Dhaka', nameBn: 'ঢাকা', lat: 23.81, lon: 90.412 },
  { name: 'Chattogram', nameBn: 'চট্টগ্রাম', lat: 22.357, lon: 91.783 },
  { name: 'Khulna', nameBn: 'খুলনা', lat: 22.846, lon: 89.54 },
  { name: 'Rajshahi', nameBn: 'রাজশাহী', lat: 24.374, lon: 88.604 },
  { name: 'Sylhet', nameBn: 'সিলেট', lat: 24.895, lon: 91.869 },
  { name: 'Barishal', nameBn: 'বরিশাল', lat: 22.701, lon: 90.353 },
  { name: 'Rangpur', nameBn: 'রংপুর', lat: 25.744, lon: 89.275 },
  { name: 'Mymensingh', nameBn: 'ময়মনসিংহ', lat: 24.747, lon: 90.42 },
]

export const BANGLADESH_CENTER: [number, number] = [90.3, 23.75]
