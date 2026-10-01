import { AnimatePresence, motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { useText } from '@/lib/i18n'
import { Section } from './Section'

const text = {
  en: {
    eyebrow: 'Components',
    title: 'Loading without the wait feeling',
    description: 'Skeletons keep the layout steady, the orbit loader shows satellites at work, and content fades in exactly where the placeholder was.',
    field: 'North rice field',
    healthy: 'Healthy',
    body: 'Your crop looks healthy. Next check in 3 days.',
    replay: 'Replay skeleton',
  },
  bn: {
    eyebrow: 'উপাদান',
    title: 'অপেক্ষা যেন অপেক্ষা মনে না হয়',
    description: 'কাঠামো-ছবি পাতাকে স্থির রাখে, কক্ষপথের লোডার দেখায় উপগ্রহ কাজ করছে, আর তথ্য ঠিক সেই জায়গাতেই ফুটে ওঠে।',
    field: 'উত্তরের ধানক্ষেত',
    healthy: 'সুস্থ',
    body: 'আপনার ফসল সুস্থ দেখাচ্ছে। পরের যাচাই ৩ দিন পর।',
    replay: 'আবার দেখান',
  },
}

export function LoadingSection() {
  const t = useText(text)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoading(false), 2200)
    return () => clearTimeout(timer)
  }, [loading])

  return (
    <Section id="loading" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative min-h-44 [&>*]:h-full">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skeleton" exit={{ opacity: 0 }}>
                <SkeletonCard className="h-full" />
              </motion.div>
            ) : (
              <motion.div key="content" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-leaf-500/15 text-leaf-300">
                      <Sprout className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold text-ink">{t.field}</p>
                      <Badge tone="leaf">{t.healthy}</Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-ink-muted">{t.body}</p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Card className="grid min-h-44 place-items-center">
          <OrbitLoader />
        </Card>

        <Card className="flex min-h-44 flex-col items-center justify-center gap-4">
          <Spinner className="size-8 text-leaf-300" />
          <Button size="sm" variant="secondary" onClick={() => setLoading(true)} disabled={loading}>
            {t.replay}
          </Button>
        </Card>
      </div>
    </Section>
  )
}
