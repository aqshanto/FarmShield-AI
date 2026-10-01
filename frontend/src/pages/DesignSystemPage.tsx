import { motion } from 'framer-motion'
import { Languages } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ButtonSection } from '@/features/design-system/ButtonSection'
import { ColorSection } from '@/features/design-system/ColorSection'
import { FieldStagesSection } from '@/features/design-system/FieldStagesSection'
import { IllustrationSection } from '@/features/design-system/IllustrationSection'
import { LoadingSection } from '@/features/design-system/LoadingSection'
import { RiskPlayground } from '@/features/design-system/RiskPlayground'
import { StatsSection } from '@/features/design-system/StatsSection'
import { TypographySection } from '@/features/design-system/TypographySection'
import { setLang, useLang, useText } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা', lang: 'bn' },
] as const

const text = {
  en: {
    eyebrow: 'FarmShield AI · Design system',
    before: 'Built to feel ',
    alive: 'alive',
    after: ', made for farmers',
    intro: 'The colors, motion and components every FarmShield screen is built from. Everything here is interactive.',
    language: 'Language',
  },
  bn: {
    eyebrow: 'ফার্মশিল্ড এআই · ডিজাইন সিস্টেম',
    before: '',
    alive: 'জীবন্ত',
    after: ' অনুভূতি, কৃষকের জন্য তৈরি',
    intro: 'ফার্মশিল্ডের প্রতিটি পাতা যে রং, নড়াচড়া আর উপাদান দিয়ে তৈরি। এখানে সবকিছু হাতে ধরে দেখা যায়।',
    language: 'ভাষা',
  },
}

// Living style guide: every building block of FarmShield AI, interactive.
export function DesignSystemPage() {
  const lang = useLang()
  const t = useText(text)

  return (
    <div className="space-y-20 py-8 lg:py-12">
      <motion.header variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-5">
        <motion.p variants={fadeUp} className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
          {t.eyebrow}
        </motion.p>
        <motion.h1 variants={fadeUp} className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-display">
          {t.before}
          <span className="text-gradient-brand">{t.alive}</span>
          {t.after}
        </motion.h1>
        <motion.p variants={fadeUp} className="max-w-2xl text-lg text-ink-muted">
          {t.intro}
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
          <Languages className="size-5 text-ink-subtle" aria-hidden="true" />
          <SegmentedControl ariaLabel={t.language} options={languageOptions} value={lang} onChange={setLang} />
        </motion.div>
      </motion.header>

      <RiskPlayground lang={lang} />
      <IllustrationSection />
      <FieldStagesSection lang={lang} />
      <StatsSection lang={lang} />
      <ButtonSection />
      <LoadingSection />
      <ColorSection />
      <TypographySection />
    </div>
  )
}
