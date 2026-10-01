import { motion } from 'framer-motion'
import { Map as MapIcon, MapPin, MessageCircle, Ruler, Satellite, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { fadeUp, stagger } from '@/lib/motion'
import type { Dashboard, FarmSummary } from '@/types/api'
import { greeting, timeAgo } from './format'

interface FarmHeaderProps {
  dashboard: Dashboard
  farms: FarmSummary[]
  onFarmChange: (farmId: string) => void
}

export function FarmHeader({ dashboard, farms, onFarmChange }: FarmHeaderProps) {
  const { farm } = dashboard
  // Open the map on this farm's most pressing risk.
  const worst = dashboard.modules.reduce((a, b) => (b.score > a.score ? b : a), dashboard.modules[0])
  const mapHref = `/map?farm=${encodeURIComponent(farm.id)}${worst && worst.id !== 'flood_risk' ? `&layer=${worst.id}` : ''}`

  return (
    <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <motion.p variants={fadeUp} className="text-sm font-semibold text-leaf-300">
          {greeting()} 👋
        </motion.p>
        <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {farm.name}
        </motion.h1>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          <Badge icon={<MapPin className="size-3.5" />}>
            {farm.district}, {farm.division}
          </Badge>
          <Badge icon={<Sprout className="size-3.5" />}>{farm.crop}</Badge>
          <Badge icon={<Ruler className="size-3.5" />}>{farm.area_acres} acres</Badge>
          <Badge tone="sky" icon={<Satellite className="size-3.5" />}>
            <span className="relative mr-0.5 flex size-1.5" aria-hidden="true">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-sky-300" />
              <span className="relative size-1.5 rounded-full bg-sky-300" />
            </span>
            Satellite pass {timeAgo(dashboard.last_satellite_pass)}
          </Badge>
          <Link
            to={mapHref}
            className="focus-ring inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-leaf-300 ring-1 ring-leaf-400/30 transition hover:bg-leaf-500/10"
          >
            <MapIcon className="size-3.5" aria-hidden="true" /> See on map
          </Link>
          <Link
            to={`/assistant?farm=${encodeURIComponent(farm.id)}`}
            className="focus-ring inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-leaf-300 ring-1 ring-leaf-400/30 transition hover:bg-leaf-500/10"
          >
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
        </motion.div>
      </div>

      {farms.length > 1 && (
        <motion.div variants={fadeUp} className="space-y-1.5">
          <p className="text-xs font-semibold text-ink-subtle">Switch farm</p>
          <SegmentedControl
            ariaLabel="Choose a farm"
            size="sm"
            value={farm.id}
            onChange={onFarmChange}
            options={farms.map((f) => ({ value: f.id, label: f.district }))}
          />
        </motion.div>
      )}
    </motion.header>
  )
}
