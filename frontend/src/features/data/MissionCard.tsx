import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Satellite } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { timeAgo } from '@/features/dashboard/format'
import type { MissionFreshness, SourceStatus } from '@/types/api'
import { type MissionInfo, missionState, SOURCE_NAMES } from './missions'

const stateBadge = {
  live: { tone: 'leaf', label: 'Live', icon: <CheckCircle2 className="size-3.5" /> },
  baseline: { tone: 'sky', label: 'Baseline', icon: <CheckCircle2 className="size-3.5" /> },
  'stand-in': { tone: 'harvest', label: 'Using stand-in', icon: <KeyRound className="size-3.5" /> },
  approve: { tone: 'harvest', label: 'Approve', icon: <KeyRound className="size-3.5" /> },
  problem: { tone: 'alert', label: 'Problem', icon: <AlertTriangle className="size-3.5" /> },
  waiting: { tone: 'neutral', label: 'Waiting', icon: <Clock className="size-3.5" /> },
} as const

interface MissionCardProps {
  mission: MissionInfo
  sources: SourceStatus[]
  freshness: MissionFreshness | undefined
  index: number
}

export function MissionCard({ mission, sources, freshness, index }: MissionCardProps) {
  const state = missionState(mission, sources)
  const badge = stateBadge[state]
  const own = sources.find((s) => s.id === mission.source)
  const usesStandIn = state === 'stand-in' || state === 'approve'
  const shown = usesStandIn ? sources.find((s) => s.id === mission.standIn) : own

  return (
    <Card interactive glow="var(--color-sky-300)" className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <motion.span
            className="grid size-11 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"
            animate={{ rotate: [0, 8, 0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, delay: index * 0.7, ease: 'easeInOut' }}
          >
            <Satellite className="size-5" aria-hidden="true" />
          </motion.span>
          <div>
            <h3 className="text-lg font-extrabold text-ink">{mission.name}</h3>
            <p className="text-[11px] text-ink-subtle">{mission.tagline}</p>
          </div>
        </div>
        <Badge tone={badge.tone} icon={badge.icon}>
          {badge.label}
        </Badge>
      </div>

      <p className="text-sm text-ink">{mission.measures}</p>

      <dl className="mt-auto space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Newest data from space</dt>
          <dd className="font-semibold text-ink">
            {freshness?.latest_granule ? timeAgo(freshness.latest_granule) : freshness?.error ? 'Unavailable' : '…'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Readings for your farms</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {shown ? `${shown.observations}${usesStandIn ? ` via ${SOURCE_NAMES[shown.id]}` : ''}` : '—'}
          </dd>
        </div>
        {own && own.rejected > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-ink-subtle">Cloudy views removed</dt>
            <dd className="font-semibold text-harvest-300 tabular-nums">{own.rejected}</dd>
          </div>
        )}
      </dl>

      <p className="border-t border-line pt-2 text-[11px] text-ink-subtle">
        {state === 'stand-in'
          ? 'Add a free Earthdata token to use this mission’s own measurements.'
          : state === 'approve'
            ? 'Your token works. Approve this archive once in Earthdata Login (see below).'
          : state === 'problem'
            ? (own?.message ?? 'The source did not answer.')
            : (own?.product ?? '')}
      </p>
    </Card>
  )
}
