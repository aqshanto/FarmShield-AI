import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Bug, CloudOff, CloudRain, Droplets, Pause, Play, Sprout, Sun } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Slider } from '@/components/ui/Slider'
import { cn } from '@/lib/cn'
import { type Lang, setLang, useLang } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { type RiskLevel, riskMeta, RISK_LEVELS, scoreToLevel } from '@/lib/risk'
import type { Dashboard, RiskModule } from '@/types/api'
import { FieldScene } from './FieldScene'
import { type FieldFocus, fieldCrop, fieldState, fieldText, stageIndex, stageLabel, todayScores, trendScores } from './fieldState'

const MODULES: RiskModule[] = ['flood_risk', 'water_stress', 'crop_health']
const ICONS: Record<RiskModule, typeof Droplets> = { flood_risk: CloudRain, water_stress: Droplets, crop_health: Sprout }
const STEP_MS = 700

/** Four steps, the current one lit, with the stage in words. */
export function StageMeter({ module, level, crop, lang }: { module: RiskModule; level: RiskLevel; crop: ReturnType<typeof fieldCrop>; lang: Lang }) {
  const t = fieldText[lang]
  const index = stageIndex(level)
  const Icon = ICONS[module]
  const label = stageLabel(module, crop, level, lang)
  return (
    <div className="space-y-1.5" data-module={module}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <Icon className="size-4 text-ink-muted" aria-hidden="true" />
          {t[module]}
        </span>
        <span className="text-xs text-ink-subtle">{t.stageOf(index)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1" role="img" aria-label={`${t[module]}: ${label}, ${t.stageOf(index)}`}>
        {RISK_LEVELS.map((l, i) => (
          <motion.span
            key={l}
            className="h-2 rounded-full"
            initial={false}
            animate={{ opacity: i <= index ? 1 : 0.25, scaleY: i === index ? 1.5 : 1 }}
            transition={spring.snappy}
            style={{ backgroundColor: riskMeta[l].color }}
          />
        ))}
      </div>
      <p className="text-sm font-semibold" style={{ color: `color-mix(in oklab, ${riskMeta[level].color} 70%, white)` }}>
        {label}
      </p>
    </div>
  )
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1 rounded-full bg-night-950/70 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur"
    >
      {icon}
      {children}
    </motion.span>
  )
}

// "My field today": a living picture of the farmer's field, its stage for each risk,
// and a replay of the last two weeks.
export function FieldView({ dashboard }: { dashboard: Dashboard }) {
  const lang = useLang()
  const [focus, setFocus] = useState<FieldFocus>('all')
  const days = trendScores(dashboard)
  const last = Math.max(0, days.length - 1)
  const [replay, setReplay] = useState<{ day: number; playing: boolean } | null>(null)
  const t = fieldText[lang]
  const crop = fieldCrop(dashboard.farm.crop)

  // Step through the days while playing; stop on today.
  useEffect(() => {
    if (!replay?.playing) return
    const timer = setTimeout(() => {
      setReplay((r) => (r && r.day < last ? { ...r, day: r.day + 1 } : r && { ...r, playing: false }))
    }, STEP_MS)
    return () => clearTimeout(timer)
  }, [replay, last])

  const scores = replay ? days[replay.day] ?? todayScores(dashboard) : todayScores(dashboard)
  const live = !replay || replay.day === last
  const state = fieldState(dashboard, scores, focus, live)
  const levels = Object.fromEntries(MODULES.map((m) => [m, scoreToLevel(scores[m])])) as Record<RiskModule, RiskLevel>
  const shown = focus === 'all' ? MODULES : [focus]
  const danger = shown.some((m) => levels[m] === 'danger')
  const daysAgo = last - (replay?.day ?? last)
  const sceneLabel = shown.map((m) => `${t[m]}: ${stageLabel(m, crop, levels[m], lang)}`).join('. ')

  const changeLang = (next: Lang) => setLang(next)
  const togglePlay = () =>
    setReplay((r) => (r?.playing ? { ...r, playing: false } : { day: !r || r.day >= last ? 0 : r.day, playing: true }))

  return (
    <Card className="overflow-hidden p-0" aria-labelledby="field-view-title">
      <div lang={lang} className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div>
          <h2 id="field-view-title" className="text-xl font-bold text-ink">
            {t.title}
          </h2>
          <p className="text-sm text-ink-muted">{t.subtitle}</p>
        </div>
        <SegmentedControl<Lang>
          ariaLabel="Language / ভাষা"
          size="sm"
          value={lang}
          onChange={changeLang}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'bn', label: 'বাংলা', lang: 'bn' },
          ]}
        />
      </div>

      <div className="px-5 pt-4 sm:px-6">
        <SegmentedControl<FieldFocus>
          ariaLabel={t.title}
          size="sm"
          value={focus}
          onChange={setFocus}
          options={[
            { value: 'all', label: t.all, lang },
            ...MODULES.map((m) => {
              const Icon = ICONS[m]
              return { value: m, label: t[m], lang, icon: <Icon className="size-3.5" aria-hidden="true" /> }
            }),
          ]}
        />
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[3fr_2fr]">
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-line">
          <FieldScene state={state} label={sceneLabel} />
          {/* Today's signals, in words as well as pictures */}
          <div lang={lang} className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1.5">
            <AnimatePresence>
              {state.rain > 0.3 && <Chip key="rain" icon={<CloudRain className="size-3.5 text-sky-300" aria-hidden="true" />}>{t.rain}</Chip>}
              {state.heat > 0.4 && <Chip key="heat" icon={<Sun className="size-3.5 text-harvest-300" aria-hidden="true" />}>{t.heat}</Chip>}
              {state.disease > 0.3 && <Chip key="disease" icon={<Bug className="size-3.5 text-alert-300" aria-hidden="true" />}>{t.disease}</Chip>}
            </AnimatePresence>
          </div>
          {!live && (
            <span lang={lang} className="absolute top-2 right-2 rounded-full bg-night-950/75 px-2.5 py-1 text-xs font-bold text-ink">
              {t.daysAgo(daysAgo)}
            </span>
          )}
          {state.hiddenByClouds && (
            <p lang={lang} className="absolute inset-x-2 bottom-2 flex items-start gap-1.5 rounded-xl bg-night-950/75 px-2.5 py-1.5 text-xs text-ink backdrop-blur">
              <CloudOff className="mt-0.5 size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
              {t.hidden}
            </p>
          )}
        </div>

        <div lang={lang} className="flex flex-col gap-4">
          <div className="space-y-4">
            {shown.map((m) => (
              <StageMeter key={m} module={m} level={levels[m]} crop={crop} lang={lang} />
            ))}
          </div>

          <AnimatePresence>
            {danger && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2 rounded-xl bg-alert-500/15 px-3 py-2 text-sm font-bold text-alert-300 ring-1 ring-alert-400/40"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {t.danger}
              </motion.p>
            )}
          </AnimatePresence>

          {days.length > 1 && (
            <div className="mt-auto space-y-2 rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
              <button
                type="button"
                onClick={togglePlay}
                className={cn(
                  'focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition',
                  replay?.playing ? 'bg-surface-3 text-ink' : 'bg-gradient-to-b from-leaf-300 to-leaf-500 text-night-950',
                )}
              >
                {replay?.playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {replay?.playing ? t.pause : t.play}
              </button>
              <Slider
                label={t.day}
                min={0}
                max={last}
                value={replay?.day ?? last}
                valueLabel={live ? t.today : t.daysAgo(daysAgo)}
                onChange={(day) => setReplay(day === last ? null : { day, playing: false })}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
