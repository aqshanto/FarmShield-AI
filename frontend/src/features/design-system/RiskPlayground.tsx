import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { RainCloudIllustration } from '@/components/illustrations/RainCloudIllustration'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Slider } from '@/components/ui/Slider'
import { type Lang, numberLocale } from '@/lib/i18n'
import { riskMeta, scoreToLevel } from '@/lib/risk'
import { Section } from './Section'

const copy = {
  en: { ring: 'Flood risk', caption: 'risk score', slider: 'Rainfall this week' },
  bn: { ring: 'বন্যার ঝুঁকি', caption: 'ঝুঁকি স্কোর', slider: 'এই সপ্তাহের বৃষ্টি' },
}

// Interactive demo: drag rainfall and watch the whole risk vocabulary respond together.
export function RiskPlayground({ lang }: { lang: Lang }) {
  const [score, setScore] = useState(38)
  const level = scoreToLevel(score)
  const meta = riskMeta[level]
  const t = copy[lang]
  const rainfall = Math.round(score * 2.4)

  return (
    <Section
      id="risk"
      eyebrow="Signature pattern"
      title="One risk language everywhere"
      description="A 0–100 score becomes a color, a label, a sentence and a picture. Drag the slider to see them move together."
    >
      <Card interactive glow={meta.color} className="p-6 sm:p-8">
        <div className="grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
          <ScoreRing score={score} label={t.ring} caption={t.caption} locale={numberLocale[lang]} className="mx-auto" />

          <div className="space-y-4" lang={lang}>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-ink">{t.ring}</h3>
              <RiskBadge level={level} lang={lang} />
            </div>
            <div className="min-h-14">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={`${level}-${lang}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-lg text-ink-muted"
                >
                  {lang === 'bn' ? meta.messageBn : meta.message}
                </motion.p>
              </AnimatePresence>
            </div>
            <Slider
              label={t.slider}
              value={score}
              onChange={setScore}
              valueLabel={`${new Intl.NumberFormat(numberLocale[lang]).format(rainfall)} mm`}
              color={meta.color}
            />
          </div>

          <div className="mx-auto">
            <RainCloudIllustration intensity={score / 100} size={140} />
          </div>
        </div>
      </Card>
    </Section>
  )
}
