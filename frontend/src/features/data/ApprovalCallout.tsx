import { ExternalLink, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// Token accepted, but an archive (GES DISC for GPM) needs its terms approved once.
export function ApprovalCallout({ links }: { links: { mission: string; url: string }[] }) {
  if (!links.length) return null
  const [first] = links
  const missions = [...new Set(links.map((l) => l.mission))].join(' and ')
  return (
    <Card className="border-harvest-300/30 bg-harvest-400/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-harvest-400/15 text-harvest-300">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-ink">One click left for {missions}</h2>
          <p className="text-sm text-ink-muted">
            Your Earthdata token works (SMAP data is flowing). NASA’s archive for {missions} also asks you to accept its data terms
            once. Until then, NASA POWER stands in.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              <a href={first.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-leaf-300 underline-offset-2 hover:underline">
                Open the approval page <ExternalLink className="size-3" aria-hidden="true" />
              </a>{' '}
              and approve <span className="font-semibold text-ink">NASA GESDISC DATA ARCHIVE</span>.
            </li>
            <li>Come back and press “Refresh from NASA”. No new token is needed.</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}
