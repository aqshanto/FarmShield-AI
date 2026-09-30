import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, MapPin, RotateCw, Satellite, Server, Sprout } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { fadeUp, pop, spring, stagger } from '@/lib/motion'
import { type RetryPolicy, useSystemStatus } from './useSystemStatus'

type RowState = 'loading' | 'done' | 'failed'

interface CheckRowProps {
  icon: ReactNode
  title: string
  detail: ReactNode
  state: RowState
}

function CheckRow({ icon, title, detail, state }: CheckRowProps) {
  return (
    <motion.li variants={fadeUp} className="glass flex items-start gap-3 rounded-2xl p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-night-800 text-leaf-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <div className="text-sm text-ink-muted">{detail}</div>
      </div>
      {/* Keyed so each state change remounts the icon with a fresh pop-in. */}
      <motion.div
        key={state}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
        className="mt-2"
      >
        {state === 'loading' && <Spinner className="text-sky-300" label="Checking" />}
        {state === 'done' && <CheckCircle2 className="size-5 text-risk-safe" aria-label="Ready" />}
        {state === 'failed' && <CircleAlert className="size-5 text-risk-danger" aria-label="Not connected" />}
      </motion.div>
    </motion.li>
  )
}

// Live "mission check" proving every layer of the foundation is wired up.
export function SystemStatusPanel({ retryPolicy }: { retryPolicy?: RetryPolicy }) {
  const { status, retry } = useSystemStatus(retryPolicy)
  const backendState: RowState =
    status.state === 'loading' ? 'loading' : status.state === 'ready' ? 'done' : 'failed'

  return (
    <section aria-labelledby="mission-check" className="w-full">
      <h2 id="mission-check" className="mb-3 text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
        Mission check
      </h2>
      <motion.ul variants={stagger(0.12, 0.2)} initial="hidden" animate="show" className="space-y-2" aria-live="polite">
        <CheckRow icon={<Sprout className="size-5" />} title="App is ready" detail="Frontend is running" state="done" />
        <CheckRow
          icon={<Server className="size-5" />}
          title="Farm brain connected"
          state={backendState}
          detail={
            status.state === 'ready'
              ? `API v${status.health.version} · ${status.health.data_mode} data`
              : status.state === 'offline'
                ? 'Backend is not reachable yet'
                : 'Connecting…'
          }
        />
        <CheckRow
          icon={<Satellite className="size-5" />}
          title="NASA satellites listening"
          state={backendState}
          detail={
            status.state === 'ready' ? (
              <motion.span variants={stagger(0.08)} initial="hidden" animate="show" className="mt-1 flex flex-wrap gap-1.5">
                {status.sources.map((source) => (
                  <motion.span key={source.id} variants={pop}>
                    <Badge tone="sky" title={`${source.full_name}: ${source.measures}`}>
                      {source.name}
                    </Badge>
                  </motion.span>
                ))}
              </motion.span>
            ) : (
              'Waiting for the farm brain'
            )
          }
        />
        <CheckRow
          icon={<MapPin className="size-5" />}
          title="Focus region"
          state={backendState}
          detail={status.state === 'ready' ? status.region.name : 'Waiting for the farm brain'}
        />
      </motion.ul>

      <AnimatePresence>
        {status.state === 'offline' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl bg-alert-400/10 p-4 text-sm text-alert-300 ring-1 ring-alert-400/30">
              <p>
                The backend is sleeping. Start it with <code className="rounded bg-black/30 px-1">npm run dev</code> from the
                project root, then try again.
              </p>
              <Button variant="danger" size="sm" className="mt-3" icon={<RotateCw className="size-4" />} onClick={retry}>
                Try again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
