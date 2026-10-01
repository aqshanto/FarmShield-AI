import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, MapPinOff, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { FarmHeader } from '@/features/dashboard/FarmHeader'
import { ForecastStrip } from '@/features/dashboard/ForecastStrip'
import { OverallCard } from '@/features/dashboard/OverallCard'
import { RecommendationList } from '@/features/dashboard/RecommendationList'
import { DETAIL_PANEL_ID, RiskCard } from '@/features/dashboard/RiskCard'
import { RiskDetailPanel } from '@/features/dashboard/RiskDetailPanel'
import { FieldView } from '@/features/field/FieldView'
import { ApiError, api } from '@/lib/api'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { useAsync } from '@/lib/useAsync'
import type { RiskModule } from '@/types/api'

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const farms = useAsync('farms', (signal) => api.farms({ signal }), { retries: 3 })
  const farmId = params.get('farm') ?? farms.data?.[0]?.id ?? null
  const dashboard = useAsync(farmId, (signal) => api.dashboard(farmId!, { signal }), { retries: 3 })

  // Selection belongs to a farm, so switching farms closes the detail panel.
  const [selection, setSelection] = useState<{ farmId: string | null; module: RiskModule } | null>(null)
  const selected = selection?.farmId === farmId ? selection.module : null

  const selectModule = (module: RiskModule) => {
    setSelection(selected === module ? null : { farmId, module })
    // Bring the detail panel into view once it has rendered.
    requestAnimationFrame(() => document.getElementById(DETAIL_PANEL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const changeFarm = (id: string) => setParams({ farm: id }, { preventScrollReset: true })

  const data = dashboard.data
  const error = farms.status === 'error' ? farms.error : dashboard.status === 'error' ? dashboard.error : null

  if (error && !data) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="grid place-items-center py-20">
        <Card className="max-w-md space-y-4 p-8 text-center">
          {notFound ? (
            <MapPinOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          ) : (
            <CloudOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          )}
          <h1 className="text-xl font-bold text-ink">{notFound ? 'We couldn’t find that farm' : 'We couldn’t load your farm'}</h1>
          <p className="text-ink-muted">
            {notFound
              ? 'The link may be old or mistyped. Pick one of your farms instead.'
              : 'The farm brain isn’t answering right now. Check that the backend is running, then try again.'}
          </p>
          <div className="flex justify-center gap-2">
            {!notFound && (
              <Button
                icon={<RotateCw className="size-4" />}
                onClick={() => {
                  farms.retry()
                  dashboard.retry()
                }}
              >
                Try again
              </Button>
            )}
            {params.get('farm') && (
              <Button variant={notFound ? 'primary' : 'secondary'} onClick={() => setParams({})}>
                Show my first farm
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  if (!data || !farms.data) {
    return (
      <div className="py-8">
        <DashboardSkeleton />
      </div>
    )
  }

  // Switching farms: keep the old farm on screen, dimmed, until the new one arrives.
  const switching = dashboard.status === 'loading' && data.farm.id !== farmId
  const selectedModule = data.modules.find((m) => m.id === selected) ?? null

  return (
    <div className="relative py-8">
      <AnimatePresence>
        {switching && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-night-900/90 px-5 py-2"
          >
            <OrbitLoader label="Reading satellite data…" className="flex-row gap-2 [&>div]:size-6" />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-alert-400/10 p-4 text-sm text-alert-300 ring-1 ring-alert-400/30">
          <span>Couldn’t load that farm. Showing {data.farm.name} instead.</span>
          <Button size="sm" variant="danger" icon={<RotateCw className="size-4" />} onClick={dashboard.retry}>
            Try again
          </Button>
        </div>
      )}

      <motion.div
        key={data.farm.id}
        variants={stagger(0.1)}
        initial="hidden"
        animate="show"
        className={`space-y-6 transition-opacity duration-300 ${switching ? 'pointer-events-none opacity-40' : ''}`}
        aria-busy={switching}
      >
        <FarmHeader dashboard={data} farms={farms.data} onFarmChange={changeFarm} />

        <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <OverallCard dashboard={data} selected={selected} onSelect={selectModule} />
          </div>
          <div className="lg:col-span-3">
            <RecommendationList farmId={data.farm.id} recommendations={data.recommendations} />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <FieldView dashboard={data} />
        </motion.div>

        <motion.section variants={fadeUp} aria-labelledby="risks-title" className="space-y-4">
          <h2 id="risks-title" className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
            Your three risks
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {data.modules.map((module) => (
              <RiskCard key={module.id} module={module} selected={selected === module.id} onSelect={() => selectModule(module.id)} />
            ))}
          </div>

          <div id={DETAIL_PANEL_ID} className="scroll-mt-24">
            <AnimatePresence mode="wait">
              {selectedModule && (
                <motion.div
                  key={selectedModule.id}
                  initial={{ opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -12, height: 0 }}
                  transition={spring.gentle}
                  className="overflow-hidden"
                >
                  <RiskDetailPanel module={selectedModule} crop={data.farm.crop} onClose={() => setSelection(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        <motion.div variants={fadeUp}>
          <ForecastStrip forecast={data.forecast} />
        </motion.div>
      </motion.div>
    </div>
  )
}
