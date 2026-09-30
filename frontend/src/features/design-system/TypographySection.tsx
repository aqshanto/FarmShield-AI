import { Card } from '@/components/ui/Card'
import { Section } from './Section'

export function TypographySection() {
  return (
    <Section
      id="typography"
      eyebrow="Foundations"
      title="Friendly, readable type"
      description="Plus Jakarta Sans for a warm, modern voice, and Noto Sans Bengali so Bengali reads just as clearly. Both are bundled, so they work offline in the field."
    >
      <Card className="space-y-5">
        <p className="text-display text-gradient-brand">Healthy fields</p>
        <p className="text-3xl font-bold tracking-tight text-ink">Rain is coming on Thursday</p>
        <p className="text-xl font-semibold text-ink">Water your rice field early this week</p>
        <p className="max-w-2xl text-base text-ink-muted">
          Body text stays short and plain. We say “Your crop looks healthy”, never “NDVI value: 0.62”.
        </p>
        <p lang="bn" className="text-xl font-semibold text-ink">
          বৃহস্পতিবার বৃষ্টি আসছে। এই সপ্তাহে আগে সেচ দিন।
        </p>
        <p className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">Eyebrow label</p>
      </Card>
    </Section>
  )
}
