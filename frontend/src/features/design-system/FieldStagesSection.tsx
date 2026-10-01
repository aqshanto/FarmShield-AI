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

export function FieldStagesSection({ lang }: { lang: Lang }) {
  const [crop, setCrop] = useState<FieldCrop>('rice')
  const [module, setModule] = useState<RiskModule>('flood_risk')

  return (
    <Section
      id="field-stages"
      eyebrow="Living field view"
      title="Four stages for every risk"
      description="The dashboard's field picture follows the same four levels as every risk. Rice keeps its normal paddy water when safe; the danger stage warns, it never claims damage."
    >
      <div className="flex flex-wrap gap-3">
        <SegmentedControl<FieldCrop>
          ariaLabel="Crop"
          size="sm"
          value={crop}
          onChange={setCrop}
          options={[
            { value: 'rice', label: 'Rice' },
            { value: 'wheat', label: 'Wheat' },
            { value: 'potato', label: 'Potato' },
          ]}
        />
        <SegmentedControl<RiskModule>
          ariaLabel="Risk"
          size="sm"
          value={module}
          onChange={setModule}
          options={[
            { value: 'flood_risk', label: 'Flood' },
            { value: 'water_stress', label: 'Water' },
            { value: 'crop_health', label: 'Crop' },
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
