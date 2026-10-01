import { motion, useScroll, useSpring } from 'framer-motion'
import { CloudRain, Droplets, Gauge, Leaf, MessageCircle, Mic, Satellite, Sprout } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn } from '@/lib/cn'
import { useLang, useText } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'

const text = {
  en: {
    missions: ['feels how wet the soil is', 'measures rain from space', 'sees how green crops are', 'knows what “normal green” is'],
    reasons: ['Heavy rain on the way', 'Ground already full', 'Low-lying field'],
    compared: 'Compared with what is normal for this place and season.',
    rows: ['Flood risk', 'Water for the crop', 'Crop health'],
    today: 'Today: clear your drainage channels',
    question: 'আজ কি সেচ দেব?',
    reply: 'আজ সেচ লাগবে না। মাটিতে যথেষ্ট পানি আছে, আর কাল বৃষ্টি আসছে।',
    askHint: 'Ask by voice or text, in বাংলা or English.',
    eyebrow: 'How it works',
    title: 'From space to the field, in time to act',
    step: (n: number) => `STEP ${n}`,
    steps: [
      ['Satellites watch every field', 'Four NASA missions pass over Bangladesh every day, measuring rain, soil water and how green the crops are.'],
      ['FarmShield understands the signs', 'Our risk engines compare today with what is normal for that place and season, and find the reasons behind each risk.'],
      ['One clear answer for the farmer', 'No charts to decode: three simple signals and the one thing worth doing today.'],
      ['Ask in your own language', 'A friendly assistant explains the risks and answers questions in Bengali or English, by text or voice.'],
    ],
  },
  bn: {
    missions: ['মাটি কতটা ভেজা তা বোঝে', 'মহাকাশ থেকে বৃষ্টি মাপে', 'ফসল কতটা সবুজ তা দেখে', 'জানে “স্বাভাবিক সবুজ” কেমন'],
    reasons: ['ভারী বৃষ্টি আসছে', 'মাটি আগেই পানিতে ভরা', 'নিচু জমি'],
    compared: 'এই জায়গা আর এই মৌসুমের স্বাভাবিক অবস্থার সাথে তুলনা করে।',
    rows: ['বন্যার ঝুঁকি', 'ফসলের পানি', 'ফসলের স্বাস্থ্য'],
    today: 'আজ: নালা পরিষ্কার করুন',
    question: 'আজ কি সেচ দেব?',
    reply: 'আজ সেচ লাগবে না। মাটিতে যথেষ্ট পানি আছে, আর কাল বৃষ্টি আসছে।',
    askHint: 'মুখে বা লিখে জিজ্ঞেস করুন, বাংলা বা ইংরেজিতে।',
    eyebrow: 'যেভাবে কাজ করে',
    title: 'মহাকাশ থেকে মাঠে, সময় থাকতেই',
    step: (n: number) => `ধাপ ${'০১২৩৪'[n]}`,
    steps: [
      ['উপগ্রহ প্রতিটি জমির খেয়াল রাখে', 'নাসার চারটি মিশন প্রতিদিন বাংলাদেশের উপর দিয়ে যায়, আর বৃষ্টি, মাটির পানি ও ফসলের সবুজ ভাব মাপে।'],
      ['ফার্মশিল্ড লক্ষণগুলো বোঝে', 'আমাদের ঝুঁকি-যন্ত্র আজকের অবস্থা ওই জায়গা ও মৌসুমের স্বাভাবিকের সাথে তুলনা করে, আর প্রতিটি ঝুঁকির কারণ খুঁজে বের করে।'],
      ['কৃষকের জন্য একটি পরিষ্কার উত্তর', 'জটিল চার্ট নেই: তিনটি সহজ সংকেত আর আজকের সবচেয়ে জরুরি কাজটি।'],
      ['নিজের ভাষায় জিজ্ঞেস করুন', 'বন্ধুর মতো একজন সহকারী ঝুঁকিগুলো বুঝিয়ে বলে, আর বাংলা বা ইংরেজিতে, লিখে বা মুখে প্রশ্নের উত্তর দেয়।'],
    ],
  },
}

const missions = [
  { name: 'SMAP', icon: Droplets },
  { name: 'GPM', icon: CloudRain },
  { name: 'MODIS', icon: Leaf },
  { name: 'VIIRS', icon: Sprout },
]

function SatellitesVisual() {
  const t = useText(text)
  return (
    <motion.ul variants={stagger(0.08)} className="grid grid-cols-2 gap-2">
      {missions.map((m, i) => (
        <motion.li key={m.name} variants={fadeUp} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5 ring-1 ring-line">
          <span className="relative grid size-8 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
            <span className="absolute inset-0 animate-ping-soft rounded-lg bg-sky-300/20" aria-hidden="true" />
            <m.icon className="relative size-4" aria-hidden="true" />
          </span>
          <span className="text-xs leading-tight text-ink-muted">
            <span className="block text-sm font-bold text-ink">{m.name}</span>
            {t.missions[i]}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

const REASON_VALUES = [0.86, 0.72, 0.55]

function UnderstandVisual() {
  const t = useText(text)
  return (
    <div className="space-y-2.5">
      {t.reasons.map((label, i) => (
        <div key={label} className="space-y-1">
          <p className="text-xs font-semibold text-ink-muted">{label}</p>
          <div className="h-2 rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-leaf-400"
              initial={{ width: 0 }}
              whileInView={{ width: `${REASON_VALUES[i] * 100}%` }}
              viewport={{ once: true }}
              transition={{ ...spring.gentle, delay: 0.2 + i * 0.12 }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-ink-subtle">{t.compared}</p>
    </div>
  )
}

const ANSWER_ROWS = [
  [CloudRain, 'warning'],
  [Droplets, 'safe'],
  [Sprout, 'watch'],
] as const

function AnswerVisual() {
  const t = useText(text)
  const lang = useLang()
  return (
    <div className="space-y-2">
      {ANSWER_ROWS.map(([Icon, level], i) => (
        <div key={level} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon className="size-4 text-ink-muted" aria-hidden="true" />
            {t.rows[i]}
          </span>
          <RiskBadge level={level} lang={lang} />
        </div>
      ))}
      <motion.p
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ ...spring.bouncy, delay: 0.5 }}
        className="rounded-xl bg-gradient-to-b from-leaf-300 to-leaf-500 px-3 py-2 text-center text-sm font-bold text-night-950"
      >
        {t.today}
      </motion.p>
    </div>
  )
}

function AskVisual() {
  const t = useText(text)
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
        <Mic className="size-3.5" aria-hidden="true" /> {t.question}
      </motion.p>
      <motion.p
        lang="bn"
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ ...spring.gentle, delay: 0.55 }}
        className="glass w-fit max-w-[90%] rounded-2xl rounded-bl-md px-3 py-2 text-sm text-ink"
      >
        {t.reply}
      </motion.p>
      <p className="text-xs text-ink-subtle">{t.askHint}</p>
    </div>
  )
}

const STEP_PARTS: { icon: typeof Satellite; visual: ReactNode }[] = [
  { icon: Satellite, visual: <SatellitesVisual /> },
  { icon: Gauge, visual: <UnderstandVisual /> },
  { icon: Sprout, visual: <AnswerVisual /> },
  { icon: MessageCircle, visual: <AskVisual /> },
]

// Scroll story: a line draws down the page as each step rises into view.
export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const t = useText(text)
  const steps = STEP_PARTS.map((part, i) => ({ ...part, title: t.steps[i][0], body: t.steps[i][1] }))

  return (
    <section aria-labelledby="how-it-works" className="space-y-8">
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.08)} className="space-y-2 text-center">
        <motion.p variants={fadeUp} className="text-sm font-semibold tracking-widest text-leaf-300 uppercase">
          {t.eyebrow}
        </motion.p>
        <motion.h2 variants={fadeUp} id="how-it-works" className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.title}
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
                <p className="text-xs font-bold tracking-widest text-ink-subtle">{t.step(i + 1)}</p>
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
