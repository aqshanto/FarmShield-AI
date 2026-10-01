import { type Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import type { Lang } from '@/lib/i18n'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre finds its worker next to its own module at runtime, which breaks once Vite
// relocates the library. Let Vite bundle the worker (with its shared chunk) and hand
// MapLibre the resulting URL; this works in dev and in the production build.
// Imported by every component that creates a map.
setWorkerUrl(maplibreWorkerUrl)

const CONTROL_LABELS: Record<Lang, Record<string, string>> = {
  en: { '.maplibregl-ctrl-zoom-in': 'Zoom in', '.maplibregl-ctrl-zoom-out': 'Zoom out', '.maplibregl-ctrl-attrib-button': 'Toggle attribution' },
  bn: { '.maplibregl-ctrl-zoom-in': 'কাছে আনুন', '.maplibregl-ctrl-zoom-out': 'দূরে সরান', '.maplibregl-ctrl-attrib-button': 'তথ্যসূত্র দেখান' },
}

/** Names the map canvas and the zoom / attribution buttons in the reader's language. */
export function localizeMap(map: MapLibreMap, lang: Lang, canvasLabel: string) {
  map.getCanvas().setAttribute('aria-label', canvasLabel)
  for (const [selector, label] of Object.entries(CONTROL_LABELS[lang])) {
    map.getContainer().querySelectorAll(selector).forEach((el) => {
      el.setAttribute('title', label)
      el.setAttribute('aria-label', label)
    })
  }
}
