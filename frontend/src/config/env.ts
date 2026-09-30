// Runtime configuration, read from Vite env variables (see .env.example).
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
} as const
