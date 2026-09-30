import { CloudRain, Droplets, type LucideIcon, Sprout } from 'lucide-react'
import type { ReactNode } from 'react'
import { RainCloudIllustration } from '@/components/illustrations/RainCloudIllustration'
import { SproutIllustration } from '@/components/illustrations/SproutIllustration'
import { WaterDropIllustration } from '@/components/illustrations/WaterDropIllustration'
import type { RiskModule } from '@/types/api'

interface ModuleVisual {
  icon: LucideIcon
  // Accent for icons and card glow (identity, not status).
  accent: string
  // Picture of the situation; score is the 0–100 risk score.
  illustration: (score: number, size: number) => ReactNode
}

// How each risk module looks. Risk scores are inverted where the picture shows the "good"
// quantity: water available, plant health.
export const moduleVisuals: Record<RiskModule, ModuleVisual> = {
  flood_risk: {
    icon: CloudRain,
    accent: 'var(--color-sky-300)',
    illustration: (score, size) => <RainCloudIllustration intensity={score / 100} size={size} />,
  },
  water_stress: {
    icon: Droplets,
    accent: 'var(--color-sky-400)',
    illustration: (score, size) => <WaterDropIllustration level={1 - score / 100} size={size} />,
  },
  crop_health: {
    icon: Sprout,
    accent: 'var(--color-leaf-400)',
    illustration: (score, size) => <SproutIllustration health={1 - score / 100} size={size} />,
  },
}

// Plain-language description of each NASA source, shown under "What the satellites looked at".
export const sourceDescriptions: Record<string, string> = {
  GPM: 'Rainfall measured from space, every 30 minutes',
  SMAP: 'How wet the top layer of soil is',
  MODIS: 'Plant greenness and land temperature',
  VIIRS: 'A second view of plants and land, day and night',
}
