import { CloudRain, Droplets, Leaf, Thermometer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { TimeSeriesChart } from '@/components/ui/TimeSeriesChart'
import { digits, useLang, useText } from '@/lib/i18n'
import type { FarmObservations } from '@/types/api'
import { find, greennessSummary, greennessWord, isoDaysBefore, prettyDate, rainSummary, wetnessWord } from './insights'
import { SOURCE_NAMES } from './missions'

const CHART_1 = 'var(--color-chart-1)'
const CHART_2 = 'var(--color-chart-2)'

const text = {
  en: {
    mm: 'mm',
    none: 'No readings yet',
    rainWeek: 'Rain, last 7 days',
    rainMonth: (mm: string) => `${mm} mm this month`,
    surface: 'Surface soil',
    hottest: 'Hottest day this week',
    dailyMax: 'Daily maximum',
    greenness: 'Plant greenness',
    waitingView: 'Waiting for a clear view',
    rainTitle: 'Daily rainfall',
    rainCaption: (month: string, date: string, wettest: string) =>
      `${month} mm in the last 30 days. Wettest day: ${date} (${wettest} mm). Readings arrive about 3 days after they fall.`,
    noRain: 'No rainfall readings yet.',
    rainLabel: 'Daily rainfall, last 60 days',
    rainSummary: (month: string) => `Daily rainfall in millimetres. ${month} mm fell in the last 30 days.`,
    noData: 'No data.',
    rainSeries: 'Rainfall',
    soilTitle: 'Soil wetness',
    soilCaption: (word: string, pct: string) => `Surface soil is ${word} (${pct}%). Root-zone water changes more slowly and shows what crops can reach.`,
    noSoil: 'No soil readings yet.',
    soilLabel: 'Soil wetness, last 60 days',
    soilSummary: 'Surface and root-zone soil wetness from 0% (dry) to 100% (saturated).',
    rootZone: 'Root zone',
    smapTitle: 'SMAP soil moisture',
    smapCaption: 'Measured directly by SMAP’s microwave radiometer, in cubic metres of water per cubic metre of soil.',
    smapLabel: 'SMAP soil moisture, last 60 days',
    smapSummary: 'Volumetric soil moisture from SMAP.',
    greenTitle: 'Plant greenness vs normal',
    lastView: (date: string) => `Last clear view on ${date}: `,
    underWater: (ndvi: string) => `the field was under water (NDVI ${ndvi}).`,
    greenState: (word: string, ndvi: string, comparison: string) => `${word.toLowerCase()} (NDVI ${ndvi}), ${comparison}.`,
    noNormal: 'no normal to compare',
    cloudGap: (days: string) => `Clouds have hidden this field for ${days} days, which is normal in the monsoon. SMAP’s radar sees through clouds.`,
    waitingClear: 'Waiting for a cloud-free view of this field.',
    greenLabel: 'Plant greenness (NDVI), last 120 days, with seasonal normal',
    greenSummary: 'Plant greenness from MODIS (dots; outlined dots are lower quality) against the 2013–2023 VIIRS normal for this time of year (line).',
    thisSeason: 'This season (MODIS)',
    normalSeries: 'Normal (VIIRS 2013–23)',
    cloudsHidden: 'Clouds have hidden this field. Waiting for a clear view.',
    tempTitle: 'Daily high temperature',
    tempCaption: (hot: string) => `Hottest day this week: ${hot}. Above 35°C, crops lose water fast.`,
    tempLabel: 'Daily maximum temperature, last 60 days',
    tempSummary: 'Daily maximum air temperature in degrees Celsius.',
    tempSeries: 'Max temperature',
  },
  bn: {
    mm: 'মিমি',
    none: 'এখনও কোনো তথ্য নেই',
    rainWeek: 'বৃষ্টি, গত ৭ দিন',
    rainMonth: (mm: string) => `এই মাসে ${mm} মিমি`,
    surface: 'উপরের মাটি',
    hottest: 'এই সপ্তাহের সবচেয়ে গরম দিন',
    dailyMax: 'দিনের সর্বোচ্চ',
    greenness: 'গাছের সবুজ ভাব',
    waitingView: 'পরিষ্কার ছবির অপেক্ষায়',
    rainTitle: 'দৈনিক বৃষ্টি',
    rainCaption: (month: string, date: string, wettest: string) =>
      `গত ৩০ দিনে ${month} মিমি। সবচেয়ে বেশি বৃষ্টি: ${date} (${wettest} মিমি)। বৃষ্টির প্রায় ৩ দিন পর তথ্য আসে।`,
    noRain: 'এখনও বৃষ্টির তথ্য নেই।',
    rainLabel: 'দৈনিক বৃষ্টি, গত ৬০ দিন',
    rainSummary: (month: string) => `মিলিমিটারে দৈনিক বৃষ্টি। গত ৩০ দিনে ${month} মিমি বৃষ্টি হয়েছে।`,
    noData: 'তথ্য নেই।',
    rainSeries: 'বৃষ্টি',
    soilTitle: 'মাটির আর্দ্রতা',
    soilCaption: (word: string, pct: string) => `উপরের মাটি ${word} (${pct}%)। শিকড়ের কাছের পানি ধীরে বদলায় আর দেখায় ফসল কতটা পানি পায়।`,
    noSoil: 'এখনও মাটির তথ্য নেই।',
    soilLabel: 'মাটির আর্দ্রতা, গত ৬০ দিন',
    soilSummary: 'উপরের মাটি আর শিকড়ের স্তরের আর্দ্রতা, ০% (শুকনো) থেকে ১০০% (পানিতে ভরা)।',
    rootZone: 'শিকড়ের স্তর',
    smapTitle: 'SMAP মাটির আর্দ্রতা',
    smapCaption: 'SMAP-এর মাইক্রোওয়েভ যন্ত্রে সরাসরি মাপা, প্রতি ঘনমিটার মাটিতে কত ঘনমিটার পানি।',
    smapLabel: 'SMAP মাটির আর্দ্রতা, গত ৬০ দিন',
    smapSummary: 'SMAP থেকে মাটির আর্দ্রতা।',
    greenTitle: 'স্বাভাবিকের তুলনায় গাছের সবুজ ভাব',
    lastView: (date: string) => `শেষ পরিষ্কার ছবি ${date}: `,
    underWater: (ndvi: string) => `জমি পানির নিচে ছিল (NDVI ${ndvi})।`,
    greenState: (word: string, ndvi: string, comparison: string) => `${word} (NDVI ${ndvi}), ${comparison}।`,
    noNormal: 'তুলনার জন্য স্বাভাবিক মান নেই',
    cloudGap: (days: string) => `${days} দিন ধরে মেঘ এই জমি ঢেকে রেখেছে, বর্ষায় যা স্বাভাবিক। SMAP-এর রাডার মেঘ ভেদ করে দেখে।`,
    waitingClear: 'এই জমির মেঘমুক্ত ছবির অপেক্ষায়।',
    greenLabel: 'গাছের সবুজ ভাব (NDVI), গত ১২০ দিন, মৌসুমি স্বাভাবিকের সাথে',
    greenSummary: 'MODIS থেকে গাছের সবুজ ভাব (বিন্দু; ফাঁপা বিন্দু কম মানের), বছরের এই সময়ের ২০১৩–২০২৩ VIIRS স্বাভাবিকের (রেখা) সাথে।',
    thisSeason: 'এই মৌসুম (MODIS)',
    normalSeries: 'স্বাভাবিক (VIIRS ২০১৩–২৩)',
    cloudsHidden: 'মেঘ এই জমি ঢেকে রেখেছে। পরিষ্কার ছবির অপেক্ষায়।',
    tempTitle: 'দৈনিক সর্বোচ্চ তাপমাত্রা',
    tempCaption: (hot: string) => `এই সপ্তাহের সবচেয়ে গরম দিন: ${hot}। ৩৫°সে-এর বেশি হলে ফসল দ্রুত পানি হারায়।`,
    tempLabel: 'দৈনিক সর্বোচ্চ তাপমাত্রা, গত ৬০ দিন',
    tempSummary: 'ডিগ্রি সেলসিয়াসে দৈনিক সর্বোচ্চ বাতাসের তাপমাত্রা।',
    tempSeries: 'সর্বোচ্চ তাপমাত্রা',
  },
}

function Sources({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <Badge key={id} tone="sky" className="px-2 text-[10px]">
          {SOURCE_NAMES[id] ?? id}
        </Badge>
      ))}
    </span>
  )
}

function ChartCard({ icon, title, sources, caption, children }: { icon: ReactNode; title: string; sources: string[]; caption: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          {icon}
          {title}
        </h3>
        <Sources ids={sources} />
      </div>
      <p className="text-sm text-ink-muted">{caption}</p>
      {children}
    </Card>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-[11px] text-ink-subtle">{hint}</p>
    </div>
  )
}

const niceMax = (max: number) => (max <= 10 ? 10 : max <= 25 ? 25 : max <= 50 ? 50 : Math.ceil(max / 50) * 50)

export function FarmDataCharts({ data }: { data: FarmObservations }) {
  const lang = useLang()
  const t = useText(text)
  const n = (v: number) => digits(Math.round(v), lang)
  const fixed = (v: number) => digits(v.toFixed(2), lang)
  const today = data.generated_at.slice(0, 10)
  const start60 = isoDaysBefore(today, data.days)
  const start120 = isoDaysBefore(today, 120)

  const rain = find(data.variables, 'precipitation')
  const wet = find(data.variables, 'soil_wetness')
  const root = find(data.variables, 'root_zone_wetness')
  const smap = find(data.variables, 'soil_moisture')
  const temp = find(data.variables, 'temperature_max')
  const ndvi = find(data.variables, 'ndvi')
  const normal = find(data.variables, 'ndvi_normal')

  const rainInfo = rain ? rainSummary(rain.points, today) : null
  const green = ndvi && normal ? greennessSummary(ndvi.points, normal.points, today, lang) : null
  const rainMax = niceMax(Math.max(0, ...(rain?.points.map((p) => p.value) ?? [0])))
  const hottest = temp?.points.filter((p) => p.date > isoDaysBefore(today, 7)).reduce((a, b) => Math.max(a, b.value), -Infinity)
  const hottestText = hottest && Number.isFinite(hottest) ? `${n(hottest)}°C` : '—'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.rainWeek} value={rainInfo ? `${n(rainInfo.week)} ${t.mm}` : '—'} hint={rainInfo ? t.rainMonth(n(rainInfo.month)) : t.none} />
        <Stat
          label={t.surface}
          value={wet?.latest ? `${n(wet.latest.value * 100)}%` : '—'}
          hint={wet?.latest ? `${wetnessWord(wet.latest.value, lang)} · ${prettyDate(wet.latest.date, lang)}` : t.none}
        />
        <Stat label={t.hottest} value={hottestText} hint={t.dailyMax} />
        <Stat
          label={t.greenness}
          value={green ? greennessWord(green.last.value, lang) : '—'}
          hint={green ? `NDVI ${fixed(green.last.value)} · ${prettyDate(green.last.date, lang)}` : t.waitingView}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          icon={<CloudRain className="size-5 text-sky-300" aria-hidden="true" />}
          title={t.rainTitle}
          sources={rain?.sources_used ?? []}
          caption={rainInfo ? t.rainCaption(n(rainInfo.month), prettyDate(rainInfo.wettest.date, lang), n(rainInfo.wettest.value)) : t.noRain}
        >
          <TimeSeriesChart
            label={t.rainLabel}
            summary={rainInfo ? t.rainSummary(n(rainInfo.month)) : t.noData}
            series={[{ id: 'rain', label: t.rainSeries, color: CHART_1, kind: 'bar', points: rain?.points ?? [] }]}
            start={start60}
            end={today}
            yDomain={[0, rainMax]}
            yTicks={[0, rainMax / 2, rainMax]}
            formatValue={(v) => n(v)}
          />
        </ChartCard>

        <ChartCard
          icon={<Droplets className="size-5 text-sky-300" aria-hidden="true" />}
          title={t.soilTitle}
          sources={[...new Set([...(wet?.sources_used ?? []), ...(root?.sources_used ?? [])])]}
          caption={wet?.latest ? t.soilCaption(wetnessWord(wet.latest.value, lang), n(wet.latest.value * 100)) : t.noSoil}
        >
          <TimeSeriesChart
            label={t.soilLabel}
            summary={t.soilSummary}
            series={[
              { id: 'surface', label: t.surface, color: CHART_1, kind: 'line', points: wet?.points ?? [] },
              { id: 'root', label: t.rootZone, color: CHART_2, kind: 'line', points: root?.points ?? [] },
            ]}
            start={start60}
            end={today}
            yDomain={[0, 1]}
            yTicks={[0, 0.5, 1]}
            formatValue={(v) => `${n(v * 100)}%`}
          />
        </ChartCard>

        {smap && smap.points.length > 0 && (
          <ChartCard icon={<Droplets className="size-5 text-sky-300" aria-hidden="true" />} title={t.smapTitle} sources={smap.sources_used} caption={t.smapCaption}>
            <TimeSeriesChart
              label={t.smapLabel}
              summary={t.smapSummary}
              series={[{ id: 'smap', label: 'SMAP', color: CHART_1, kind: 'points', points: smap.points }]}
              start={start60}
              end={today}
              yDomain={[0, 0.6]}
              yTicks={[0, 0.3, 0.6]}
              formatValue={(v) => fixed(v)}
            />
          </ChartCard>
        )}

        <ChartCard
          icon={<Leaf className="size-5 text-leaf-300" aria-hidden="true" />}
          title={t.greenTitle}
          sources={[...new Set([...(ndvi?.sources_used ?? []), ...(normal?.sources_used ?? [])])]}
          caption={
            green ? (
              <>
                {t.lastView(prettyDate(green.last.date, lang))}
                {green.last.value < 0.1
                  ? t.underWater(fixed(green.last.value))
                  : t.greenState(greennessWord(green.last.value, lang), fixed(green.last.value), green.comparison ?? t.noNormal)}
                {green.cloudGapDays > 30 && (
                  <>
                    {' '}
                    <span className="text-harvest-300">{t.cloudGap(n(green.cloudGapDays))}</span>
                  </>
                )}
              </>
            ) : (
              t.waitingClear
            )
          }
        >
          <TimeSeriesChart
            label={t.greenLabel}
            summary={t.greenSummary}
            series={[
              {
                id: 'ndvi',
                label: t.thisSeason,
                color: CHART_1,
                kind: 'points',
                points: (ndvi?.points ?? []).map((p) => ({ ...p, hollow: p.quality !== 'good' })),
              },
              { id: 'normal', label: t.normalSeries, color: CHART_2, kind: 'line', points: normal?.points ?? [] },
            ]}
            start={start120}
            end={today}
            yDomain={[-0.2, 1]}
            yTicks={[0, 0.5, 1]}
            formatValue={(v) => fixed(v)}
            emptyMessage={t.cloudsHidden}
          />
        </ChartCard>

        {temp && temp.points.length > 0 && (
          <ChartCard
            icon={<Thermometer className="size-5 text-harvest-300" aria-hidden="true" />}
            title={t.tempTitle}
            sources={temp.sources_used}
            caption={t.tempCaption(hottestText)}
          >
            <TimeSeriesChart
              label={t.tempLabel}
              summary={t.tempSummary}
              series={[{ id: 'temp', label: t.tempSeries, color: CHART_1, kind: 'line', points: temp.points }]}
              start={start60}
              end={today}
              yDomain={[15, 45]}
              yTicks={[15, 30, 45]}
              formatValue={(v) => `${n(v)}°`}
            />
          </ChartCard>
        )}
      </div>
    </div>
  )
}
