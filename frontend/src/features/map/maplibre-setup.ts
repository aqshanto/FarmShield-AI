import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre finds its worker next to its own module at runtime, which breaks once Vite
// relocates the library. Let Vite bundle the worker (with its shared chunk) and hand
// MapLibre the resulting URL; this works in dev and in the production build.
// Imported by every component that creates a map.
setWorkerUrl(maplibreWorkerUrl)
