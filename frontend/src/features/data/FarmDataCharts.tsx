import { CloudRain, Droplets, Leaf, Thermometer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { TimeSeriesChart } from '@/components/ui/TimeSeriesChart'
import type { FarmObservations } from '@/types/api'
import { find, greennessSummary, greennessWord, isoDaysBefore, prettyDate, rainSummary, wetnessWord } from './insights'
import { SOURCE_NAMES } from './missions'

const CHART_1 = 'var(--color-chart-1)'
const CHART_2 = 'var(--color-chart-2)'

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
  const green = ndvi && normal ? greennessSummary(ndvi.points, normal.points, today) : null
  const rainMax = niceMax(Math.max(0, ...(rain?.points.map((p) => p.value) ?? [0])))
  const hottest = temp?.points.filter((p) => p.date > isoDaysBefore(today, 7)).reduce((a, b) => Math.max(a, b.value), -Infinity)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rain, last 7 days" value={rainInfo ? `${Math.round(rainInfo.week)} mm` : '—'} hint={rainInfo ? `${Math.round(rainInfo.month)} mm this month` : 'No readings yet'} />
        <Stat
          label="Surface soil"
          value={wet?.latest ? `${Math.round(wet.latest.value * 100)}%` : '—'}
          hint={wet?.latest ? `${wetnessWord(wet.latest.value)} · ${prettyDate(wet.latest.date)}` : 'No readings yet'}
        />
        <Stat label="Hottest day this week" value={hottest && Number.isFinite(hottest) ? `${Math.round(hottest)}°C` : '—'} hint="Daily maximum" />
        <Stat
          label="Plant greenness"
          value={green ? greennessWord(green.last.value) : '—'}
          hint={green ? `NDVI ${green.last.value.toFixed(2)} · ${prettyDate(green.last.date)}` : 'Waiting for a clear view'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          icon={<CloudRain className="size-5 text-sky-300" aria-hidden="true" />}
          title="Daily rainfall"
          sources={rain?.sources_used ?? []}
          caption={
            rainInfo
              ? `${Math.round(rainInfo.month)} mm in the last 30 days. Wettest day: ${prettyDate(rainInfo.wettest.date)} (${Math.round(rainInfo.wettest.value)} mm). Readings arrive about 3 days after they fall.`
              : 'No rainfall readings yet.'
          }
        >
          <TimeSeriesChart
            label="Daily rainfall, last 60 days"
            summary={rainInfo ? `Daily rainfall in millimetres. ${Math.round(rainInfo.month)} mm fell in the last 30 days.` : 'No data.'}
            series={[{ id: 'rain', label: 'Rainfall', color: CHART_1, kind: 'bar', points: rain?.points ?? [] }]}
            start={start60}
            end={today}
            yDomain={[0, rainMax]}
            yTicks={[0, rainMax / 2, rainMax]}
            formatValue={(v) => `${Math.round(v)}`}
          />
        </ChartCard>

        <ChartCard
          icon={<Droplets className="size-5 text-sky-300" aria-hidden="true" />}
          title="Soil wetness"
          sources={[...new Set([...(wet?.sources_used ?? []), ...(root?.sources_used ?? [])])]}
          caption={
            wet?.latest
              ? `Surface soil is ${wetnessWord(wet.latest.value)} (${Math.round(wet.latest.value * 100)}%). Root-zone water changes more slowly and shows what crops can reach.`
              : 'No soil readings yet.'
          }
        >
          <TimeSeriesChart
            label="Soil wetness, last 60 days"
            summary="Surface and root-zone soil wetness from 0% (dry) to 100% (saturated)."
            series={[
              { id: 'surface', label: 'Surface soil', color: CHART_1, kind: 'line', points: wet?.points ?? [] },
              { id: 'root', label: 'Root zone', color: CHART_2, kind: 'line', points: root?.points ?? [] },
            ]}
            start={start60}
            end={today}
            yDomain={[0, 1]}
            yTicks={[0, 0.5, 1]}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </ChartCard>

        {smap && smap.points.length > 0 && (
          <ChartCard
            icon={<Droplets className="size-5 text-sky-300" aria-hidden="true" />}
            title="SMAP soil moisture"
            sources={smap.sources_used}
            caption="Measured directly by SMAP’s microwave radiometer, in cubic metres of water per cubic metre of soil."
          >
            <TimeSeriesChart
              label="SMAP soil moisture, last 60 days"
              summary="Volumetric soil moisture from SMAP."
              series={[{ id: 'smap', label: 'SMAP', color: CHART_1, kind: 'points', points: smap.points }]}
              start={start60}
              end={today}
              yDomain={[0, 0.6]}
              yTicks={[0, 0.3, 0.6]}
              formatValue={(v) => v.toFixed(2)}
            />
          </ChartCard>
        )}

        <ChartCard
          icon={<Leaf className="size-5 text-leaf-300" aria-hidden="true" />}
          title="Plant greenness vs normal"
          sources={[...new Set([...(ndvi?.sources_used ?? []), ...(normal?.sources_used ?? [])])]}
          caption={
            green ? (
              <>
                Last clear view on {prettyDate(green.last.date)}:{' '}
                {green.last.value < 0.1
                  ? `the field was under water (NDVI ${green.last.value.toFixed(2)}).`
                  : `${greennessWord(green.last.value).toLowerCase()} (NDVI ${green.last.value.toFixed(2)}), ${green.comparison ?? 'no normal to compare'}.`}
                {green.cloudGapDays > 30 && (
                  <>
                    {' '}
                    <span className="text-harvest-300">
                      Clouds have hidden this field for {green.cloudGapDays} days, which is normal in the monsoon. SMAP’s radar sees through
                      clouds.
                    </span>
                  </>
                )}
              </>
            ) : (
              'Waiting for a cloud-free view of this field.'
            )
          }
        >
          <TimeSeriesChart
            label="Plant greenness (NDVI), last 120 days, with seasonal normal"
            summary="Plant greenness from MODIS (dots; outlined dots are lower quality) against the 2013–2023 VIIRS normal for this time of year (line)."
            series={[
              {
                id: 'ndvi',
                label: 'This season (MODIS)',
                color: CHART_1,
                kind: 'points',
                points: (ndvi?.points ?? []).map((p) => ({ ...p, hollow: p.quality !== 'good' })),
              },
              { id: 'normal', label: 'Normal (VIIRS 2013–23)', color: CHART_2, kind: 'line', points: normal?.points ?? [] },
            ]}
            start={start120}
            end={today}
            yDomain={[-0.2, 1]}
            yTicks={[0, 0.5, 1]}
            formatValue={(v) => v.toFixed(2)}
            emptyMessage="Clouds have hidden this field. Waiting for a clear view."
          />
        </ChartCard>

        {temp && temp.points.length > 0 && (
          <ChartCard
            icon={<Thermometer className="size-5 text-harvest-300" aria-hidden="true" />}
            title="Daily high temperature"
            sources={temp.sources_used}
            caption={`Hottest day this week: ${hottest && Number.isFinite(hottest) ? `${Math.round(hottest)}°C` : '—'}. Above 35°C, crops lose water fast.`}
          >
            <TimeSeriesChart
              label="Daily maximum temperature, last 60 days"
              summary="Daily maximum air temperature in degrees Celsius."
              series={[{ id: 'temp', label: 'Max temperature', color: CHART_1, kind: 'line', points: temp.points }]}
              start={start60}
              end={today}
              yDomain={[15, 45]}
              yTicks={[15, 30, 45]}
              formatValue={(v) => `${Math.round(v)}°`}
            />
          </ChartCard>
        )}
      </div>
    </div>
  )
}
