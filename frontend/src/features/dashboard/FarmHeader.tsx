import { AnimatePresence, motion } from 'framer-motion'
import { Check, Map as MapIcon, MapPin, MessageCircle, Pencil, Ruler, Satellite, Sprout, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { type FarmOption, FarmPicker } from '@/features/farms/FarmPicker'
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

const pill = 'focus-ring inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 transition'

/** Rename / remove controls for a field the farmer added. */
function MyFarmActions({ farm, onRemove }: { farm: MyFarm; onRemove?: (id: string) => void }) {
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
            Field name
          </label>
          <input
            id="farm-rename"
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring w-44 rounded-full bg-surface-1 px-3 py-1 text-sm text-ink ring-1 ring-line"
          />
          <button type="submit" aria-label="Save name" className={`${pill} text-leaf-300 ring-leaf-400/30 hover:bg-leaf-500/10`}>
            <Check className="size-3.5" />
          </button>
          <button type="button" aria-label="Cancel" onClick={() => setMode('idle')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            <X className="size-3.5" />
          </button>
        </motion.form>
      ) : mode === 'confirm' ? (
        <motion.span key="confirm" role="alert" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-ink">
          Remove this farm from this device?
          <button type="button" onClick={() => onRemove?.(farm.id)} className={`${pill} text-alert-300 ring-alert-400/40 hover:bg-alert-500/15`}>
            Remove
          </button>
          <button type="button" onClick={() => setMode('idle')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            Keep
          </button>
        </motion.span>
      ) : (
        <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMode('rename')} className={`${pill} text-ink-muted ring-line hover:text-ink`}>
            <Pencil className="size-3.5" aria-hidden="true" /> Rename
          </button>
          <button type="button" onClick={() => setMode('confirm')} className={`${pill} text-ink-muted ring-line hover:text-alert-300`}>
            <Trash2 className="size-3.5" aria-hidden="true" /> Remove
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

  return (
    <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="space-y-1.5">
        <p className="text-xs font-semibold text-ink-subtle">Your farms</p>
        <FarmPicker farms={farms} value={farm.id} onChange={onFarmChange} ariaLabel="Choose a farm" addLabel="Add my farm" />
      </motion.div>

      <div className="space-y-3">
        <motion.p variants={fadeUp} className="text-sm font-semibold text-leaf-300">
          {greeting()} 👋
        </motion.p>
        <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {myFarm?.name ?? farm.name}
        </motion.h1>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          {farm.custom && (
            <Badge tone="leaf" icon={<Sprout className="size-3.5" />}>
              My farm
            </Badge>
          )}
          <Badge icon={<MapPin className="size-3.5" />}>
            {farm.custom ? `Near ${farm.district}` : farm.district}, {farm.division}
          </Badge>
          <Badge icon={<Sprout className="size-3.5" />}>{farm.crop}</Badge>
          {farm.area_acres != null && <Badge icon={<Ruler className="size-3.5" />}>{farm.area_acres} acres</Badge>}
          <Badge tone="sky" icon={<Satellite className="size-3.5" />}>
            <span className="relative mr-0.5 flex size-1.5" aria-hidden="true">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-sky-300" />
              <span className="relative size-1.5 rounded-full bg-sky-300" />
            </span>
            {farm.custom ? `NASA data ${timeAgo(dashboard.last_satellite_pass)}` : `Satellite pass ${timeAgo(dashboard.last_satellite_pass)}`}
          </Badge>
          <Link to={mapHref} className={linkPill}>
            <MapIcon className="size-3.5" aria-hidden="true" /> See on map
          </Link>
          <Link to={`/assistant?farm=${encodeURIComponent(farm.id)}`} className={linkPill}>
            <MessageCircle className="size-3.5" aria-hidden="true" /> Ask FarmShield
          </Link>
          {dashboard.data_mode === 'sample' ? (
            <Badge tone="harvest" title="Demo scenario. Set DATA_MODE=live for NASA data.">
              Demo data
            </Badge>
          ) : (
            <Badge tone="leaf" title="Risks marked Live are computed from NASA data; others still use the demo scenario.">
              Live NASA data
            </Badge>
          )}
          {myFarm && <MyFarmActions key={myFarm.id} farm={myFarm} onRemove={onRemoveFarm} />}
        </motion.div>
      </div>
    </motion.header>
  )
}
