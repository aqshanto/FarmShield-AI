import { AnimatePresence, motion } from 'framer-motion'
import { CircleOff, CloudRain, Droplets, Globe2, Leaf } from 'lucide-react'
import type { ReactNode } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatDate, useLang, useText } from '@/lib/i18n'
import { useAsync } from '@/lib/useAsync'
import { latestDate, NASA_LAYERS, type NasaLayerId, nasaLayer } from './nasaLayers'

const ICONS: Record<NasaLayerId | 'off', ReactNode> = {
  off: <CircleOff className="size-3.5" aria-hidden="true" />,
  soil: <Droplets className="size-3.5" aria-hidden="true" />,
  rain: <CloudRain className="size-3.5" aria-hidden="true" />,
  green: <Leaf className="size-3.5" aria-hidden="true" />,
}

const text = {
  en: {
    picker: 'NASA world layer',
    off: 'Off',
    title: 'NASA world view',
    picture: (day: string) => `NASA picture of ${day}`,
    newest: 'Newest NASA picture',
  },
  bn: {
    picker: 'নাসার বিশ্ব-স্তর',
    off: 'বন্ধ',
    title: 'নাসার বিশ্ব-দৃশ্য',
    picture: (day: string) => `${day} তারিখের নাসার ছবি`,
    newest: 'নাসার সর্বশেষ ছবি',
  },
}

// Phones show icons only (the name stays for screen readers); wider screens show both.
function PickerLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only whitespace-nowrap sm:not-sr-only">{children}</span>
}

/** Off / soil moisture / rainfall / greenness: NASA's own global pictures under the risk grid. */
export function NasaLayerPicker({ value, onChange }: { value: NasaLayerId | null; onChange: (value: NasaLayerId | null) => void }) {
  const lang = useLang()
  const t = useText(text)
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1 rounded-full bg-night-900/85 px-2 py-0.5 text-[10px] font-bold tracking-[0.15em] text-sky-300 uppercase">
        <Globe2 className="size-3" aria-hidden="true" /> {t.title}
      </span>
      <SegmentedControl<NasaLayerId | 'off'>
        ariaLabel={t.picker}
        size="sm"
        value={value ?? 'off'}
        onChange={(v) => onChange(v === 'off' ? null : v)}
        className="bg-night-900/85"
        options={[
          { value: 'off', label: <PickerLabel>{t.off}</PickerLabel>, icon: ICONS.off },
          ...NASA_LAYERS.map((l) => ({ value: l.id, label: <PickerLabel>{l.text[lang].name}</PickerLabel>, icon: ICONS[l.id] })),
        ]}
      />
    </div>
  )
}

/** What the colors mean, in words, and which day NASA took the picture. */
export function NasaLegend({ id }: { id: NasaLayerId }) {
  const lang = useLang()
  const t = useText(text)
  const layer = nasaLayer(id)
  const words = layer.text[lang]
  const day = useAsync(`gibs-day|${id}`, (signal) => latestDate(layer, signal))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="glass w-56 rounded-2xl bg-night-900/85 p-3 sm:w-64"
      role="group"
      aria-label={words.name}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            {ICONS[id]} {words.name}
            <span className="ml-auto rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">{layer.mission}</span>
          </p>
          <p className="mt-0.5 hidden text-xs text-ink-muted sm:block">{words.about}</p>
          <div
            className="mt-2 h-2.5 rounded-full ring-1 ring-white/10"
            style={{ background: `linear-gradient(to right, ${layer.stops.join(', ')})` }}
            aria-hidden="true"
          />
          <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-muted">
            <span>{words.low}</span>
            <span>{words.high}</span>
          </div>
          <p className="mt-1.5 text-[10px] text-ink-subtle">
            {day.data ? t.picture(formatDate(day.data, lang, { day: 'numeric', month: 'long' })) : t.newest}
          </p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
