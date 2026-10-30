import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, Coins, Droplets, HeartHandshake, Mountain, RotateCw, Soup, Sprout } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { type FarmOption, FarmPicker } from '@/features/farms/FarmPicker'
import { ClimateStrip } from '@/features/rotation/ClimateStrip'
import { StrategyCard } from '@/features/rotation/StrategyCard'
import { rotationText } from '@/features/rotation/strings'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useLang, useText } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { useMyFarms } from '@/lib/myFarms'
import { useAsync } from '@/lib/useAsync'
import type { RotationPlan, RotationPriority } from '@/types/api'

const PRIORITIES: { id: RotationPriority; icon: ReactNode }[] = [
  { id: 'soil', icon: <Sprout className="size-4" aria-hidden="true" /> },
  { id: 'water', icon: <Droplets className="size-4" aria-hidden="true" /> },
  { id: 'income', icon: <Coins className="size-4" aria-hidden="true" /> },
  { id: 'food', icon: <Soup className="size-4" aria-hidden="true" /> },
]

/** Bangladesh's farming year starts with the winter (rabi) crops in November; elsewhere, with the first suggested season. */
function yearStart(plan: RotationPlan) {
  if (plan.in_bangladesh) return 11
  return plan.strategies.find((s) => !s.existing)?.crops[0]?.months[0] ?? 1
}

export function RotationPage() {
  const [params, setParams] = useSearchParams()
  const lang = useLang()
  const t = useText(rotationText)
  const farms = useAsync(`farms|${lang}`, (signal) => api.farms({ signal }, lang), { retries: 3 })
  const mine = useMyFarms()
  const farmId = params.get('farm') ?? mine[0]?.id ?? farms.data?.[0]?.id ?? null
  const options: FarmOption[] = [
    ...mine.map((f) => ({ id: f.id, label: f.name, mine: true })),
    ...(farms.data ?? []).map((f) => ({ id: f.id, label: f.district, mine: false })),
  ]

  const [priorities, setPriorities] = useState<RotationPriority[]>([])
  const [irrigation, setIrrigation] = useState(true)
  // The rotation grown now belongs to a farm: switching farms goes back to its likely one.
  const [chosen, setChosen] = useState<{ farmId: string | null; id: string } | null>(null)
  const existing = chosen?.farmId === farmId ? chosen.id : null

  const query = { priorities, irrigation, existing }
  const plan = useAsync(
    farmId ? `${farmId}|${priorities.join(',')}|${irrigation}|${existing ?? ''}|${lang}` : null,
    (signal) => api.rotation(farmId!, query, { signal }, lang),
    { retries: 2 },
  )

  const togglePriority = (id: RotationPriority) =>
    setPriorities((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].sort()))

  const data = plan.data
  const error = farms.status === 'error' ? farms.error : plan.status === 'error' ? plan.error : null

  if (error && !data) {
    const status = error instanceof ApiError ? error.status : 0
    return (
      <div className="grid place-items-center py-20">
        <Card className="max-w-md space-y-4 p-8 text-center">
          <CloudOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          <h1 className="text-xl font-bold text-ink">{t.failed}</h1>
          <p className="text-ink-muted">{status === 409 ? t.demoMode : status === 404 ? t.notFound : t.failedHint}</p>
          <div className="flex justify-center gap-2">
            {status !== 409 && status !== 404 && (
              <Button
                icon={<RotateCw className="size-4" />}
                onClick={() => {
                  farms.retry()
                  plan.retry()
                }}
              >
                {t.retry}
              </Button>
            )}
            {params.get('farm') && (
              <Button variant="secondary" onClick={() => setParams({})}>
                {t.firstFarm}
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // Changing an option keeps the old ideas on screen, dimmed, until the new ones arrive.
  const updating = plan.status === 'loading' && data !== undefined
  const start = data ? yearStart(data) : 11
  const current = data?.strategies.find((s) => s.existing)
  const ideas = data?.strategies.filter((s) => !s.existing) ?? []

  return (
    <div className="relative space-y-8 py-8">
      <AnimatePresence>
        {updating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-night-900/90 px-5 py-2"
          >
            <OrbitLoader label={t.updating} className="flex-row gap-2 [&>div]:size-6" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={fadeUp} className="space-y-1.5">
          <p className="text-xs font-semibold text-ink-subtle">{t.yourFarms}</p>
          <FarmPicker
            farms={options}
            value={farmId}
            onChange={(id) => setParams({ farm: id }, { preventScrollReset: true })}
            ariaLabel={t.choose}
            addLabel={t.add}
            lang={lang}
          />
        </motion.div>
        <motion.div variants={fadeUp} className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold tracking-widest text-leaf-300 uppercase">{t.eyebrow}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">{t.title}</h1>
          <p className="text-ink-muted">{t.intro}</p>
        </motion.div>
      </motion.header>

      <Card className="grid gap-6 md:grid-cols-3">
        <fieldset className="space-y-2.5">
          <legend className="mb-2.5 text-sm font-bold text-ink">{t.prioritiesTitle}</legend>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => {
              const on = priorities.includes(p.id)
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => togglePriority(p.id)}
                  className={cn(
                    'focus-ring relative inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors',
                    on ? 'text-night-950 ring-transparent' : 'bg-surface-2 text-ink-muted ring-line hover:text-ink',
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId={`priority-${p.id}`}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={spring.bouncy}
                      className="absolute inset-0 rounded-full bg-gradient-to-b from-leaf-300 to-leaf-500 shadow-glow-leaf"
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    {p.icon}
                    {t.priorities[p.id]}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </fieldset>

        <div className="space-y-2.5">
          <p className="text-sm font-bold text-ink" id="irrigation-title">
            {t.irrigationTitle}
          </p>
          <SegmentedControl
            ariaLabel={t.irrigationTitle}
            options={[
              { value: 'yes', label: t.yes, icon: <Droplets className="size-4" aria-hidden="true" /> },
              { value: 'no', label: t.no },
            ]}
            value={irrigation ? 'yes' : 'no'}
            onChange={(v) => setIrrigation(v === 'yes')}
          />
        </div>

        <div className="space-y-2.5">
          <label htmlFor="rotation-now" className="block text-sm font-bold text-ink">
            {t.nowTitle}
          </label>
          <select
            id="rotation-now"
            disabled={!data || data.existing_options.length < 2}
            value={data?.existing_id ?? ''}
            onChange={(e) => setChosen({ farmId, id: e.target.value })}
            className="focus-ring w-full cursor-pointer rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink ring-1 ring-line disabled:cursor-default disabled:opacity-70"
          >
            {(data?.existing_options ?? []).map((o) => (
              <option key={o.id} value={o.id} className="bg-night-900">
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {!data || !current ? (
        <div className="grid place-items-center py-16">
          <OrbitLoader label={t.loading} />
        </div>
      ) : (
        <motion.div
          key={data.farm_id}
          variants={stagger(0.1)}
          initial="hidden"
          animate="show"
          aria-busy={updating}
          className={cn('space-y-8 transition-opacity duration-300', updating && 'pointer-events-none opacity-50')}
        >
          <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ClimateStrip plan={data} start={start} lang={lang} t={t} />
            </div>
            <div className="space-y-4 lg:col-span-2">
              {data.field_notes.length > 0 && (
                <Card className="space-y-2.5">
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                    <Mountain className="size-5 text-harvest-300" aria-hidden="true" /> {t.notesTitle}
                  </h2>
                  <ul className="space-y-1.5 text-sm text-ink">
                    {data.field_notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card className="space-y-2 bg-leaf-500/5 ring-1 ring-leaf-400/20">
                <h2 className="flex items-center gap-2 text-base font-bold text-leaf-200">
                  <HeartHandshake className="size-5" aria-hidden="true" /> {t.disclaimerTitle}
                </h2>
                <p className="text-sm text-ink-muted">{t.disclaimer}</p>
              </Card>
            </div>
          </motion.div>

          <motion.div variants={stagger(0.12)} className="grid gap-6 md:grid-cols-2">
            {[current, ...ideas].map((s, i) => (
              <StrategyCard key={s.id} strategy={s} current={current} best={i === 1 && s.overall > current.overall} start={start} lang={lang} t={t} />
            ))}
          </motion.div>

          <motion.p variants={fadeUp} className="text-center text-xs text-ink-subtle">
            {t.sources}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}
