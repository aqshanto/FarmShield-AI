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

const text = {
  en: {
    badge: 'NASA Space Apps Challenge',
    tagline: 'Satellite eyes for every farm.',
    second: 'প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ।',
    secondLang: 'bn',
    intro:
      'FarmShield turns NASA satellite data into early, simple warnings about floods, dry soil and crop stress, so farmers in Bangladesh know what to do today, in Bengali or English.',
    seeFarm: 'See a live farm',
    addFarm: 'Add my farm',
    ask: 'Ask in বাংলা',
    map: 'Explore the map',
    howItWorks: 'How it works',
    closingTitle: 'Warnings that arrive before the water does.',
    closingBody: 'Built on free, open NASA data, so it can grow to every district without new sensors in the field.',
    openDashboard: 'Open the dashboard',
    seeData: 'See the NASA data',
  },
  bn: {
    badge: 'নাসা স্পেস অ্যাপস চ্যালেঞ্জ',
    tagline: 'প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ।',
    second: 'Satellite eyes for every farm.',
    secondLang: 'en',
    intro:
      'ফার্মশিল্ড নাসার উপগ্রহ তথ্য থেকে বন্যা, শুকনো মাটি আর ফসলের চাপের আগাম ও সহজ সতর্কবার্তা দেয়, যাতে বাংলাদেশের কৃষক বাংলা বা ইংরেজিতে জানতে পারেন আজ কী করতে হবে।',
    seeFarm: 'একটি লাইভ খামার দেখুন',
    addFarm: 'আমার জমি যোগ করুন',
    ask: 'বাংলায় জিজ্ঞেস করুন',
    map: 'মানচিত্র দেখুন',
    howItWorks: 'যেভাবে কাজ করে',
    closingTitle: 'পানি আসার আগেই সতর্কবার্তা।',
    closingBody: 'বিনামূল্যের, উন্মুক্ত নাসা তথ্যের উপর তৈরি, তাই মাঠে নতুন সেন্সর ছাড়াই প্রতিটি জেলায় ছড়িয়ে দেওয়া যায়।',
    openDashboard: 'ড্যাশবোর্ড খুলুন',
    seeData: 'নাসার তথ্য দেখুন',
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
          <motion.h1 variants={fadeUp} className="text-5xl font-extrabold tracking-tight sm:text-display">
            <span className="text-gradient-brand">FarmShield AI</span>
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
