// Divisional headquarters of Bangladesh: map labels, "jump to" shortcuts and
// "near …" descriptions for picked locations.
export interface Place {
  name: string
  lat: number
  lon: number
}

export const DIVISIONS: Place[] = [
  { name: 'Dhaka', lat: 23.81, lon: 90.412 },
  { name: 'Chattogram', lat: 22.357, lon: 91.783 },
  { name: 'Khulna', lat: 22.846, lon: 89.54 },
  { name: 'Rajshahi', lat: 24.374, lon: 88.604 },
  { name: 'Sylhet', lat: 24.895, lon: 91.869 },
  { name: 'Barishal', lat: 22.701, lon: 90.353 },
  { name: 'Rangpur', lat: 25.744, lon: 89.275 },
  { name: 'Mymensingh', lat: 24.747, lon: 90.42 },
]

export const BANGLADESH_CENTER: [number, number] = [90.3, 23.75]
