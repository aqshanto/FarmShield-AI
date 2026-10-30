import { motion } from 'framer-motion'
import { ChevronDown, LayoutDashboard, Map as MapIcon, MessageCircle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/button-styles'
import { HowItWorks } from '@/features/home/HowItWorks'
import { LiveFarms } from '@/features/home/LiveFarms'
import { LivePulse } from '@/features/home/LivePulse'
import { OrbitIllustration } from '@/features/home/OrbitIllustration'
import { useLang, useText } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { useMapOverview } from '@/features/map/useMapOverview'

// The headline's danger words wear the brand gradient: [text, accent?] pieces.
type Headline = [string, boolean?][]

const text = {
  en: {
    badge: 'NASA Space Apps Challenge 2026',
    headline: [['Know before the '], ['flood', true], ['. Know before the '], ['drought', true], ['.']] as Headline,
    tagline: 'Satellite eyes for every farm.',
    second: 'মাঠে আপনি, আকাশে আমরা।',
    secondLang: 'bn',
    intro:
      'FarmShield reads NASA satellite data every day and turns it into simple advice on floods, dry soil and crop health, so farmers in Bangladesh know what to do today, in Bangla or English.',
    seeFarm: 'See a live farm',
    addFarm: 'Check my farm',
    ask: 'Ask in বাংলা',
    map: 'Explore the map',
    trust: 'Live data from NASA SMAP · GPM · MODIS · VIIRS',
    howItWorks: 'How it works',
    closingTitle: 'Warnings that arrive before the rain does.',
    closingBody: 'Built on free, open NASA data, so it can reach every district without a single new sensor in the field.',
    openDashboard: 'Open the dashboard',
    seeData: 'See the NASA data',
  },
  bn: {
    badge: 'নাসা স্পেস অ্যাপস চ্যালেঞ্জ ২০২৬',
    headline: [['বন্যার', true], [' আগেই জানুন, '], ['খরার', true], [' আগেই জানুন।']] as Headline,
    tagline: 'মাঠে আপনি, আকাশে আমরা।',
    second: 'Satellite eyes for every farm.',
    secondLang: 'en',
    intro:
      'ফার্মশিল্ড প্রতিদিন নাসার স্যাটেলাইট ডেটা দেখে, আর বন্যা, শুকনো মাটি আর ফসলের অবস্থা নিয়ে সহজ ভাষায় জানিয়ে দেয় আজ কী করবেন।',
    seeFarm: 'একটা জমি লাইভ দেখুন',
    addFarm: 'আমার জমি দেখুন',
    ask: 'বাংলায় জিজ্ঞেস করুন',
    map: 'ম্যাপ দেখুন',
    trust: 'ডেটা আসে নাসার SMAP · GPM · MODIS · VIIRS স্যাটেলাইট থেকে',
    howItWorks: 'যেভাবে কাজ করে',
    closingTitle: 'বৃষ্টি আসার আগেই সতর্কবার্তা।',
    closingBody: 'নাসার ফ্রি, ওপেন ডেটায় তৈরি, তাই মাঠে নতুন কোনো যন্ত্র না বসিয়েই দেশের প্রতিটি জেলায় পৌঁছানো যায়।',
    openDashboard: 'ড্যাশবোর্ড খুলুন',
    seeData: 'নাসার ডেটা দেখুন',
  },
}

export function HomePage() {
  const lang = useLang()
  const t = useText(text)
  const overview = useMapOverview(lang)
  const data = overview.data
  const live = data?.data_mode === 'live' && data.layers.some((l) => l.live)

  return (
    <div className="space-y-20 pb-12 sm:space-y-28">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:min-h-[calc(100svh-11rem)] lg:grid-cols-2 lg:pt-0">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeUp}>
            <Badge tone="leaf">{t.badge}</Badge>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl font-extrabold tracking-tight text-ink sm:text-display">
            {t.headline.map(([words, accent], i) =>
              accent ? (
                <span key={i} className="text-gradient-brand">
                  {words}
                </span>
              ) : (
                words
              ),
            )}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-2xl font-bold text-ink sm:text-3xl">
            {t.tagline}
          </motion.p>
          <motion.p variants={fadeUp} lang={t.secondLang} className="text-lg text-ink-muted">
            {t.second}
          </motion.p>
          <motion.p variants={fadeUp} className="max-w-lg text-ink-muted">
            {t.intro}
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <Link to="/dashboard" className={buttonStyles({ size: 'lg' })}>
              <LayoutDashboard className="size-5" aria-hidden="true" />
              {t.seeFarm}
            </Link>
            <Link to="/farms/new" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              <Plus className="size-5" aria-hidden="true" />
              {t.addFarm}
            </Link>
            <Link to="/assistant" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              <MessageCircle className="size-5" aria-hidden="true" />
              {t.ask}
            </Link>
            <Link to="/map" className={buttonStyles({ variant: 'ghost', size: 'lg' })}>
              <MapIcon className="size-5" aria-hidden="true" />
              {t.map}
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="text-sm text-ink-subtle">
            {t.trust}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          className="order-first lg:order-none"
        >
          <OrbitIllustration />
        </motion.div>

        <motion.a
          href="#how-it-works"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 1.2 }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
          className="focus-ring mx-auto hidden items-center gap-1 rounded-full px-3 py-1 text-sm text-ink-subtle hover:text-ink lg:col-span-2 lg:flex"
        >
          {t.howItWorks} <ChevronDown className="size-4" aria-hidden="true" />
        </motion.a>
      </section>

      <LivePulse overview={data} />
      <HowItWorks />
      <LiveFarms farms={data?.farms} live={live} failed={overview.status === 'error' && !data} />

      {/* Closing call to action */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={stagger(0.1)}
        className="glass relative overflow-hidden rounded-3xl px-6 py-12 text-center"
      >
        <div aria-hidden="true" className="absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-leaf-500/15 blur-3xl" />
        <motion.h2 variants={fadeUp} className="relative text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.closingTitle}
        </motion.h2>
        <motion.p variants={fadeUp} className="relative mx-auto mt-3 max-w-xl text-ink-muted">
          {t.closingBody}
        </motion.p>
        <motion.div variants={fadeUp} className="relative mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/dashboard" className={buttonStyles({ size: 'lg' })}>
            <LayoutDashboard className="size-5" aria-hidden="true" />
            {t.openDashboard}
          </Link>
          <Link to="/data" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
            {t.seeData}
          </Link>
        </motion.div>
      </motion.section>
    </div>
  )
}
