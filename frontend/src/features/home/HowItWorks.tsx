import { motion, useScroll, useSpring } from 'framer-motion'
import { CloudRain, Droplets, Gauge, Leaf, MessageCircle, Mic, Satellite, Sprout } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn } from '@/lib/cn'
import { fadeUp, spring, stagger } from '@/lib/motion'

const missions = [
  { name: 'SMAP', what: 'feels how wet the soil is', icon: Droplets },
  { name: 'GPM', what: 'measures rain from space', icon: CloudRain },
  { name: 'MODIS', what: 'sees how green crops are', icon: Leaf },
  { name: 'VIIRS', what: 'knows what “normal green” is', icon: Sprout },
]

function SatellitesVisual() {
  return (
    <motion.ul variants={stagger(0.08)} className="grid grid-cols-2 gap-2">
      {missions.map((m) => (
        <motion.li key={m.name} variants={fadeUp} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5 ring-1 ring-line">
          <span className="relative grid size-8 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
            <span className="absolute inset-0 animate-ping-soft rounded-lg bg-sky-300/20" aria-hidden="true" />
            <m.icon className="relative size-4" aria-hidden="true" />
          </span>
          <span className="text-xs leading-tight text-ink-muted">
            <span className="block text-sm font-bold text-ink">{m.name}</span>
            {m.what}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

const reasons = [
  { label: 'Heavy rain on the way', value: 0.86 },
  { label: 'Ground already full', value: 0.72 },
  { label: 'Low-lying field', value: 0.55 },
]

function UnderstandVisual() {
  return (
    <div className="space-y-2.5">
      {reasons.map((r, i) => (
        <div key={r.label} className="space-y-1">
          <p className="text-xs font-semibold text-ink-muted">{r.label}</p>
          <div className="h-2 rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-leaf-400"
              initial={{ width: 0 }}
              whileInView={{ width: `${r.value * 100}%` }}
              viewport={{ once: true }}
              transition={{ ...spring.gentle, delay: 0.2 + i * 0.12 }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-ink-subtle">Compared with what is normal for this place and season.</p>
    </div>
  )
}

function AnswerVisual() {
  return (
    <div className="space-y-2">
      {(
        [
          ['Flood risk', CloudRain, 'warning'],
          ['Water for the crop', Droplets, 'safe'],
          ['Crop health', Sprout, 'watch'],
        ] as const
      ).map(([label, Icon, level]) => (
        <div key={label} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon className="size-4 text-ink-muted" aria-hidden="true" />
            {label}
          </span>
          <RiskBadge level={level} />
        </div>
      ))}
      <motion.p
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ ...spring.bouncy, delay: 0.5 }}
        className="rounded-xl bg-gradient-to-b from-leaf-300 to-leaf-500 px-3 py-2 text-center text-sm font-bold text-night-950"
      >
        Today: clear your drainage channels
      </motion.p>
    </div>
  )
}

function AskVisual() {
  return (
    <div className="space-y-2.5">
      <motion.p
        lang="bn"
        initial={{ opacity: 0, x: 16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ ...spring.gentle, delay: 0.15 }}
        className="ml-auto flex w-fit items-center gap-1.5 rounded-2xl rounded-br-md bg-gradient-to-b from-leaf-300 to-leaf-500 px-3 py-2 text-sm font-medium text-night-950"
      >
        <Mic className="size-3.5" aria-hidden="true" /> আজ কি সেচ দেব?
      </motion.p>
      <motion.p
        lang="bn"
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ ...spring.gentle, delay: 0.55 }}
        className="glass w-fit max-w-[90%] rounded-2xl rounded-bl-md px-3 py-2 text-sm text-ink"
      >
        আজ সেচ লাগবে না। মাটিতে যথেষ্ট পানি আছে, আর কাল বৃষ্টি আসছে।
      </motion.p>
      <p className="text-xs text-ink-subtle">Ask by voice or text, in বাংলা or English.</p>
    </div>
  )
}

const steps: { icon: typeof Satellite; title: string; body: string; visual: ReactNode }[] = [
  {
    icon: Satellite,
    title: 'Satellites watch every field',
    body: 'Four NASA missions pass over Bangladesh every day, measuring rain, soil water and how green the crops are.',
    visual: <SatellitesVisual />,
  },
  {
    icon: Gauge,
    title: 'FarmShield understands the signs',
    body: 'Our risk engines compare today with what is normal for that place and season, and find the reasons behind each risk.',
    visual: <UnderstandVisual />,
  },
  {
    icon: Sprout,
    title: 'One clear answer for the farmer',
    body: 'No charts to decode: three simple signals and the one thing worth doing today.',
    visual: <AnswerVisual />,
  },
  {
    icon: MessageCircle,
    title: 'Ask in your own language',
    body: 'A friendly assistant explains the risks and answers questions in Bengali or English, by text or voice.',
    visual: <AskVisual />,
  },
]

// Scroll story: a line draws down the page as each step rises into view.
export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section aria-labelledby="how-it-works" className="space-y-8">
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.08)} className="space-y-2 text-center">
        <motion.p variants={fadeUp} className="text-sm font-semibold tracking-widest text-leaf-300 uppercase">
          How it works
        </motion.p>
        <motion.h2 variants={fadeUp} id="how-it-works" className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          From space to the field, in time to act
        </motion.h2>
      </motion.div>

      <ol ref={ref} className="relative space-y-8 sm:space-y-12">
        {/* The track and the line that fills it as you scroll */}
        <span aria-hidden="true" className="absolute top-2 bottom-2 left-5 w-0.5 rounded-full bg-line sm:left-1/2 sm:-translate-x-1/2" />
        <motion.span
          aria-hidden="true"
          style={{ scaleY: progress }}
          className="absolute top-2 bottom-2 left-5 w-0.5 origin-top rounded-full bg-gradient-to-b from-sky-300 via-leaf-300 to-leaf-500 sm:left-1/2 sm:-translate-x-1/2"
        />
        {steps.map((step, i) => {
          const right = i % 2 === 1
          return (
            <motion.li
              key={step.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger(0.1)}
              className="relative grid gap-4 pl-14 sm:grid-cols-2 sm:gap-16 sm:pl-0"
            >
              {/* Step marker on the line */}
              <motion.span
                variants={{ hidden: { scale: 0 }, show: { scale: 1, transition: spring.bouncy } }}
                className="absolute top-0 left-0 grid size-10 place-items-center rounded-full bg-night-800 text-leaf-300 ring-2 ring-leaf-400/60 shadow-glow-leaf sm:left-1/2 sm:-translate-x-1/2"
              >
                <step.icon className="size-5" aria-hidden="true" />
              </motion.span>
              <motion.div variants={fadeUp} className={cn('space-y-2 sm:pt-1', right ? 'sm:order-2 sm:pl-2' : 'sm:pr-2 sm:text-right')}>
                <p className="text-xs font-bold tracking-widest text-ink-subtle">STEP {i + 1}</p>
                <h3 className="text-xl font-bold text-ink">{step.title}</h3>
                <p className="text-ink-muted">{step.body}</p>
              </motion.div>
              <motion.div variants={fadeUp} className={cn('glass rounded-2xl p-4', right && 'sm:order-1')}>
                {step.visual}
              </motion.div>
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}
