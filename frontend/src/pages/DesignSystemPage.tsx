import { motion } from 'framer-motion'
import { Languages } from 'lucide-react'
import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ButtonSection } from '@/features/design-system/ButtonSection'
import { ColorSection } from '@/features/design-system/ColorSection'
import { FieldStagesSection } from '@/features/design-system/FieldStagesSection'
import { IllustrationSection } from '@/features/design-system/IllustrationSection'
import { LoadingSection } from '@/features/design-system/LoadingSection'
import { RiskPlayground } from '@/features/design-system/RiskPlayground'
import { StatsSection } from '@/features/design-system/StatsSection'
import { TypographySection } from '@/features/design-system/TypographySection'
import type { Lang } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা', lang: 'bn' },
] as const

// Living style guide: every building block of FarmShield AI, interactive.
export function DesignSystemPage() {
  const [lang, setLang] = useState<Lang>('en')

  return (
    <div className="space-y-20 py-8 lg:py-12">
      <motion.header variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-5">
        <motion.p variants={fadeUp} className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
          FarmShield AI · Design system
        </motion.p>
        <motion.h1 variants={fadeUp} className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-display">
          Built to feel <span className="text-gradient-brand">alive</span>, made for farmers
        </motion.h1>
        <motion.p variants={fadeUp} className="max-w-2xl text-lg text-ink-muted">
          The colors, motion and components every FarmShield screen is built from. Everything here is interactive.
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
          <Languages className="size-5 text-ink-subtle" aria-hidden="true" />
          <SegmentedControl ariaLabel="Language" options={languageOptions} value={lang} onChange={setLang} />
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
