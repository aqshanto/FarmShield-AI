import { AnimatePresence, motion } from 'framer-motion'
import { Check, Map as MapIcon, MapPin, MessageCircle, Pencil, Ruler, Satellite, Sprout, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { type FarmOption, FarmPicker } from '@/features/farms/FarmPicker'
import { bnOf, digits, useLang, useText } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { type MyFarm, myFarms } from '@/lib/myFarms'
import type { Dashboard } from '@/types/api'
import { greeting, timeAgo } from './format'

interface FarmHeaderProps {
  dashboard: Dashboard
  farms: FarmOption[]
  myFarm?: MyFarm | null
  onFarmChange: (farmId: string) => void
  onRemoveFarm?: (farmId: string) => void
}

const text = {
  en: {
    yourFarms: 'Your farms',
    choose: 'Choose a farm',
    add: 'Add my farm',
    myFarm: 'My farm',
    near: (district: string) => `Near ${district}`,
    acres: (n: string) => `${n} acres`,
    nasaData: (ago: string) => `NASA data ${ago}`,
    pass: (ago: string) => `Satellite pass ${ago}`,
    seeMap: 'See on map',
    ask: 'Ask FarmShield',
    demo: 'Demo data',
    demoTitle: 'Demo scenario. Set DATA_MODE=live for NASA data.',
    live: 'Live NASA data',
    liveTitle: 'Risks marked Live are computed from NASA data; others still use the demo scenario.',
    fieldName: 'Field name',
    saveName: 'Save name',
    cancel: 'Cancel',
    confirmRemove: 'Remove this farm from this device?',
    remove: 'Remove',
    keep: 'Keep',
    rename: 'Rename',
  },
  bn: {
    yourFarms: 'আপনার খামার',
    choose: 'খামার বেছে নিন',
    add: 'আমার জমি যোগ করুন',
    myFarm: 'আমার জমি',
    near: (district: string) => `${bnOf(district)} কাছে`,
    acres: (n: string) => `${n} একর`,
    nasaData: (ago: string) => `নাসার তথ্য ${ago}`,
    pass: (ago: string) => `উপগ্রহ গেছে ${ago}`,
    seeMap: 'মানচিত্রে দেখুন',
    ask: 'ফার্মশিল্ডকে জিজ্ঞেস করুন',
    demo: 'ডেমো তথ্য',
    demoTitle: 'ডেমো পরিস্থিতি। নাসার তথ্যের জন্য DATA_MODE=live দিন।',
    live: 'নাসার লাইভ তথ্য',
    liveTitle: '“লাইভ” চিহ্নিত ঝুঁকি নাসার তথ্য থেকে হিসাব করা; বাকিগুলো এখনও ডেমো।',
    fieldName: 'জমির নাম',
    saveName: 'নাম সংরক্ষণ করুন',
    cancel: 'বাতিল',
    confirmRemove: 'এই ডিভাইস থেকে জমিটি মুছবেন?',
    remove: 'মুছুন',
    keep: 'রাখুন',
    rename: 'নাম বদলান',
  },
}

const pill = 'focus-ring inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 transition'

/** Rename / remove controls for a field the farmer added. */
function MyFarmActions({ farm, onRemove }: { farm: MyFarm; onRemove?: (id: string) => void }) {
  const t = useText(text)
  const [mode, setMode] = useState<'idle' | 'rename' | 'confirm'>('idle')
  const [name, setName] = useState(farm.name)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    myFarms.rename(farm.id, name)
    setMode('idle')
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {mode === 'rename' ? (
        <motion.form key="rename" onSubmit={submit} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="farm-rename">
            {t.fieldName}
          </label>
          <input
            id="farm-rename"
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring w-44 rounded-full bg-surface-1 px-3 py-1 text-sm text-ink ring-1 ring-line"
          />
          <button type="submit" aria-label={t.saveName} className={`${pill} text-leaf-300 ring-leaf-400/30 hover:bg-leaf-500/10`}>
            <Check className="size-3.5" />
          </button>
          <button type="button" aria-label={t.cancel} onClick={() => setMode('idle')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            <X className="size-3.5" />
          </button>
        </motion.form>
      ) : mode === 'confirm' ? (
        <motion.span key="confirm" role="alert" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-ink">
          {t.confirmRemove}
          <button type="button" onClick={() => onRemove?.(farm.id)} className={`${pill} text-alert-300 ring-alert-400/40 hover:bg-alert-500/15`}>
            {t.remove}
          </button>
          <button type="button" onClick={() => setMode('idle')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            {t.keep}
          </button>
        </motion.span>
      ) : (
        <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMode('rename')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            <Pencil className="size-3.5" aria-hidden="true" /> {t.rename}
          </button>
          <button type="button" onClick={() => setMode('confirm')} className={`${pill} text-ink-muted ring-line hover:text-alert-300`}>
            <Trash2 className="size-3.5" aria-hidden="true" /> {t.remove}
          </button>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function FarmHeader({ dashboard, farms, myFarm, onFarmChange, onRemoveFarm }: FarmHeaderProps) {
  const { farm } = dashboard
  // Open the map on this farm's most pressing risk.
  const worst = dashboard.modules.reduce((a, b) => (b.score > a.score ? b : a), dashboard.modules[0])
  const mapHref = `/map?farm=${encodeURIComponent(farm.id)}${worst && worst.id !== 'flood_risk' ? `&layer=${worst.id}` : ''}`
  const linkPill = `${pill} text-leaf-300 ring-leaf-400/30 hover:bg-leaf-500/10`
  const lang = useLang()
  const t = useText(text)
  const ago = timeAgo(dashboard.last_satellite_pass, lang)

  return (
    <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="space-y-1.5">
        <p className="text-xs font-semibold text-ink-subtle">{t.yourFarms}</p>
        <FarmPicker farms={farms} value={farm.id} onChange={onFarmChange} ariaLabel={t.choose} addLabel={t.add} lang={lang} />
      </motion.div>

      <div className="space-y-3">
        <motion.p variants={fadeUp} className="text-sm font-semibold text-leaf-300">
          {greeting(lang)} 👋
        </motion.p>
        <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {myFarm?.name ?? farm.name}
        </motion.h1>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          {farm.custom && (
            <Badge tone="leaf" icon={<Sprout className="size-3.5" />}>
              {t.myFarm}
            </Badge>
          )}
          <Badge icon={<MapPin className="size-3.5" />}>
            {farm.custom ? t.near(farm.district) : farm.district}, {farm.division}
          </Badge>
          <Badge icon={<Sprout className="size-3.5" />}>{farm.crop}</Badge>
          {farm.area_acres != null && <Badge icon={<Ruler className="size-3.5" />}>{t.acres(digits(farm.area_acres, lang))}</Badge>}
          <Badge tone="sky" icon={<Satellite className="size-3.5" />}>
            <span className="relative mr-0.5 flex size-1.5" aria-hidden="true">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-sky-300" />
              <span className="relative size-1.5 rounded-full bg-sky-300" />
            </span>
            {farm.custom ? t.nasaData(ago) : t.pass(ago)}
          </Badge>
          <Link to={mapHref} className={linkPill}>
            <MapIcon className="size-3.5" aria-hidden="true" /> {t.seeMap}
          </Link>
          <Link to={`/assistant?farm=${encodeURIComponent(farm.id)}`} className={linkPill}>
            <MessageCircle className="size-3.5" aria-hidden="true" /> {t.ask}
          </Link>
          {dashboard.data_mode === 'sample' ? (
            <Badge tone="harvest" title={t.demoTitle}>
              {t.demo}
            </Badge>
          ) : (
            <Badge tone="leaf" title={t.liveTitle}>
              {t.live}
            </Badge>
          )}
          {myFarm && <MyFarmActions key={myFarm.id} farm={myFarm} onRemove={onRemoveFarm} />}
        </motion.div>
      </div>
    </motion.header>
  )
}
