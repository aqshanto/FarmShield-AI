import { motion } from 'framer-motion'
import { CloudOff, RefreshCw, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toast/useToast'
import { timeAgo } from '@/features/dashboard/format'
import { useLang, useText } from '@/lib/i18n'
import { FarmDataCharts } from '@/features/data/FarmDataCharts'
import { MissionCard } from '@/features/data/MissionCard'
import { ApprovalCallout } from '@/features/data/ApprovalCallout'
import { approvalLinks, MISSIONS } from '@/features/data/missions'
import { PipelineFlow } from '@/features/data/PipelineFlow'
import { TokenCallout } from '@/features/data/TokenCallout'
import { useDataStatus } from '@/features/data/useDataStatus'
import { api } from '@/lib/api'
import { fadeUp, stagger } from '@/lib/motion'
import { useAsync } from '@/lib/useAsync'

const text = {
  en: {
    partial: 'Some NASA sources did not answer',
    partialHint: 'We kept the last good readings. Try again in a few minutes.',
    fresh: 'Fresh NASA data downloaded',
    freshHint: (n: number) => `New readings from ${n} source checks are now on your farms.`,
    upToDate: 'Already up to date',
    upToDateHint: 'Your farms already have the newest NASA readings.',
    already: 'Already refreshing',
    unreachable: 'Could not reach the farm brain',
    unreachableHint: 'Check that the backend is running.',
    pipelineDown: 'We couldn’t reach the data pipeline',
    downHint: 'The farm brain isn’t answering right now. Check that the backend is running, then try again.',
    retry: 'Try again',
    eyebrow: 'NASA data pipeline',
    title: 'From orbit to your field',
    intro: 'Real measurements from four NASA missions, checked for clouds and errors, stored, and ready for your farm’s risk alerts.',
    checking: 'Checking NASA…',
    refresh: 'Refresh from NASA',
    lastChecked: (ago: string) => `Last checked ${ago}`,
    missions: 'The missions',
    farmData: 'What NASA saw at your farm',
    farmDataHint: 'Measured at the farm’s exact location. Hover or use arrow keys on a chart to read each day.',
    chooseFarm: 'Choose a farm',
    loadFailed: 'Couldn’t load this farm’s observations.',
    reading: 'Reading satellite data…',
  },
  bn: {
    partial: 'নাসার কিছু উৎস উত্তর দেয়নি',
    partialHint: 'আগের ভালো তথ্য রাখা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।',
    fresh: 'নাসার নতুন তথ্য নামানো হয়েছে',
    freshHint: (n: number) => `${String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])}টি উৎস থেকে নতুন তথ্য এখন আপনার খামারে।`,
    upToDate: 'আগে থেকেই হালনাগাদ',
    upToDateHint: 'আপনার খামারে নাসার সর্বশেষ তথ্য আগে থেকেই আছে।',
    already: 'হালনাগাদ চলছে',
    unreachable: 'সার্ভারে পৌঁছানো যায়নি',
    unreachableHint: 'ব্যাকএন্ড চালু আছে কি না দেখুন।',
    pipelineDown: 'তথ্য সংগ্রহের ব্যবস্থায় পৌঁছানো যায়নি',
    downHint: 'এখন সার্ভার উত্তর দিচ্ছে না। ব্যাকএন্ড চালু আছে কি না দেখে আবার চেষ্টা করুন।',
    retry: 'আবার চেষ্টা করুন',
    eyebrow: 'নাসার তথ্যপ্রবাহ',
    title: 'কক্ষপথ থেকে আপনার জমিতে',
    intro: 'নাসার চারটি মিশনের আসল মাপ, মেঘ আর ভুল বাদ দিয়ে যাচাই করা, সংরক্ষিত, আর আপনার খামারের ঝুঁকি-সতর্কতার জন্য তৈরি।',
    checking: 'নাসা দেখছি…',
    refresh: 'নাসা থেকে হালনাগাদ',
    lastChecked: (ago: string) => `শেষ দেখা হয়েছে ${ago}`,
    missions: 'মিশনগুলো',
    farmData: 'আপনার খামারে নাসা যা দেখেছে',
    farmDataHint: 'খামারের সঠিক জায়গায় মাপা। প্রতিদিনের তথ্য দেখতে চার্টে মাউস রাখুন বা তীর-চাবি ব্যবহার করুন।',
    chooseFarm: 'খামার বেছে নিন',
    loadFailed: 'এই খামারের তথ্য লোড করা যায়নি।',
    reading: 'উপগ্রহের তথ্য পড়ছি…',
  },
}

export function DataPage() {
  const lang = useLang()
  const t = useText(text)
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [dataVersion, setDataVersion] = useState(0)
  const [starting, setStarting] = useState(false)

  const farms = useAsync(`farms|${lang}`, (signal) => api.farms({ signal }, lang))
  const farmId = params.get('farm') ?? farms.data?.[0]?.id ?? null
  const observations = useAsync(farmId ? `${farmId}#${dataVersion}` : null, (signal) => api.farmObservations(farmId!, 60, { signal }))

  const { status, reload, waiting, trackRefresh } = useDataStatus((finished) => {
    setDataVersion((v) => v + 1)
    const run = finished.last_run
    if (run && run.error > 0) {
      toast({ tone: 'warning', title: t.partial, description: t.partialHint })
    } else if (run && run.ok > 0) {
      toast({ tone: 'success', title: t.fresh, description: t.freshHint(run.ok) })
    } else {
      toast({ tone: 'info', title: t.upToDate, description: t.upToDateHint })
    }
  })

  const refreshing = starting || waiting || (status.data?.refreshing ?? false)

  const startRefresh = async () => {
    setStarting(true)
    // Server timestamps are compared against this; allow a little clock skew.
    const startedAt = Date.now() - 5000
    try {
      const result = await api.refreshData()
      if (!result.started) toast({ tone: 'info', title: t.already, description: result.message })
      trackRefresh(startedAt)
    } catch {
      toast({ tone: 'danger', title: t.unreachable, description: t.unreachableHint })
    } finally {
      setStarting(false)
    }
  }

  if (status.status === 'error' && !status.data) {
    return (
      <div className="grid place-items-center py-20">
        <Card className="max-w-md space-y-4 p-8 text-center">
          <CloudOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          <h1 className="text-xl font-bold text-ink">{t.pipelineDown}</h1>
          <p className="text-ink-muted">{t.downHint}</p>
          <Button icon={<RotateCw className="size-4" />} onClick={reload}>
            {t.retry}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10 py-8">
      <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <motion.p variants={fadeUp} className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
            {t.eyebrow}
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {t.title}
          </motion.h1>
          <motion.p variants={fadeUp} className="max-w-2xl text-ink-muted">
            {t.intro}
          </motion.p>
        </div>
        <motion.div variants={fadeUp} className="flex flex-col items-start gap-1.5 sm:items-end">
          <Button icon={<RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />} disabled={refreshing} onClick={startRefresh}>
            {refreshing ? t.checking : t.refresh}
          </Button>
          {status.data?.last_run && (
            <p className="text-xs text-ink-subtle">{t.lastChecked(timeAgo(status.data.last_run.finished_at, lang))}</p>
          )}
        </motion.div>
      </motion.header>

      {status.data ? (
        <>
          <PipelineFlow status={status.data} farms={farms.data?.length ?? 0} />

          <section aria-labelledby="missions-title" className="space-y-4">
            <h2 id="missions-title" className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
              {t.missions}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {MISSIONS.map((mission, i) => (
                <MissionCard
                  key={mission.id}
                  index={i}
                  mission={mission}
                  sources={status.data!.sources}
                  freshness={status.data!.missions.find((m) => m.mission === mission.id)}
                />
              ))}
            </div>
          </section>

          {!status.data.token_configured && <TokenCallout />}
          <ApprovalCallout links={approvalLinks(status.data.sources)} />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="min-h-48" />
          ))}
        </div>
      )}

      <section aria-labelledby="farm-data-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="farm-data-title" className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
              {t.farmData}
            </h2>
            <p className="text-sm text-ink-muted">{t.farmDataHint}</p>
          </div>
          {farms.data && farms.data.length > 1 && farmId && (
            <SegmentedControl
              ariaLabel={t.chooseFarm}
              size="sm"
              value={farmId}
              onChange={(id) => setParams({ farm: id }, { replace: true, preventScrollReset: true })}
              options={farms.data.map((f) => ({ value: f.id, label: f.district }))}
            />
          )}
        </div>

        {observations.data ? (
          <div className={observations.status === 'loading' ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <FarmDataCharts data={observations.data} />
          </div>
        ) : observations.status === 'error' ? (
          <Card className="text-center text-ink-muted">{t.loadFailed}</Card>
        ) : (
          <div className="grid place-items-center py-12">
            <OrbitLoader label={t.reading} />
          </div>
        )}
      </section>
    </div>
  )
}
