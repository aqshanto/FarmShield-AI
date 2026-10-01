import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { FieldScene } from '@/features/field/FieldScene'
import { type FieldCrop, previewState, stageLabel } from '@/features/field/fieldState'
import type { Lang } from '@/lib/i18n'
import { RISK_LEVELS, riskMeta } from '@/lib/risk'
import type { RiskModule } from '@/types/api'
import { Section } from './Section'

// A score in the middle of each level's band: 0–24, 25–49, 50–74, 75–100.
const STAGE_SCORES = [12, 37, 62, 88]

const text = {
  en: {
    eyebrow: 'Living field view',
    title: 'Four stages for every risk',
    description:
      "The dashboard's field picture follows the same four levels as every risk. Rice keeps its normal paddy water when safe; the danger stage warns, it never claims damage.",
    crop: 'Crop',
    risk: 'Risk',
    crops: { rice: 'Rice', wheat: 'Wheat', potato: 'Potato' },
    risks: { flood_risk: 'Flood', water_stress: 'Water', crop_health: 'Crop' },
  },
  bn: {
    eyebrow: 'জীবন্ত জমির ছবি',
    title: 'প্রতিটি ঝুঁকির চারটি ধাপ',
    description:
      'ড্যাশবোর্ডের জমির ছবি প্রতিটি ঝুঁকির মতোই চারটি ধাপ মেনে চলে। নিরাপদ অবস্থায় ধানক্ষেতে স্বাভাবিক পানি থাকে; বিপদের ধাপ সতর্ক করে, ক্ষতি হয়েছে বলে দাবি করে না।',
    crop: 'ফসল',
    risk: 'ঝুঁকি',
    crops: { rice: 'ধান', wheat: 'গম', potato: 'আলু' },
    risks: { flood_risk: 'বন্যা', water_stress: 'পানি', crop_health: 'ফসল' },
  },
}

export function FieldStagesSection({ lang }: { lang: Lang }) {
  const [crop, setCrop] = useState<FieldCrop>('rice')
  const [module, setModule] = useState<RiskModule>('flood_risk')
  const t = text[lang]

  return (
    <Section id="field-stages" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="flex flex-wrap gap-3">
        <SegmentedControl<FieldCrop>
          ariaLabel={t.crop}
          size="sm"
          value={crop}
          onChange={setCrop}
          options={[
            { value: 'rice', label: t.crops.rice },
            { value: 'wheat', label: t.crops.wheat },
            { value: 'potato', label: t.crops.potato },
          ]}
        />
        <SegmentedControl<RiskModule>
          ariaLabel={t.risk}
          size="sm"
          value={module}
          onChange={setModule}
          options={[
            { value: 'flood_risk', label: t.risks.flood_risk },
            { value: 'water_stress', label: t.risks.water_stress },
            { value: 'crop_health', label: t.risks.crop_health },
          ]}
        />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RISK_LEVELS.map((level, i) => {
          const label = stageLabel(module, crop, level, lang)
          return (
            <li key={level} className="glass space-y-2 rounded-2xl p-3">
              <FieldScene state={previewState(crop, module, STAGE_SCORES[i])} label={label} />
              <p className="flex items-center gap-2 text-sm font-semibold text-ink" lang={lang}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: riskMeta[level].color }} aria-hidden="true" />
                {label}
              </p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
