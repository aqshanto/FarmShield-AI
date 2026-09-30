import { ExternalLink, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// How to switch GPM and SMAP from the NASA POWER stand-in to the missions' own data.
export function TokenCallout() {
  return (
    <Card className="border-harvest-300/30 bg-harvest-400/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-harvest-400/15 text-harvest-300">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-ink">Unlock GPM and SMAP measurements</h2>
          <p className="text-sm text-ink-muted">
            Rainfall and soil moisture are coming from NASA POWER right now. With a free NASA Earthdata token, FarmShield reads
            them straight from the GPM and SMAP missions.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              Create an account at{' '}
              <a
                href="https://urs.earthdata.nasa.gov/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-leaf-300 underline-offset-2 hover:underline"
              >
                urs.earthdata.nasa.gov <ExternalLink className="size-3" aria-hidden="true" />
              </a>{' '}
              and choose <span className="font-semibold text-ink">Generate Token</span>.
            </li>
            <li>
              Add it to <code className="rounded bg-black/30 px-1">backend/.env</code> as{' '}
              <code className="rounded bg-black/30 px-1">EARTHDATA_TOKEN=…</code>
            </li>
            <li>Restart the backend, then press “Refresh from NASA”.</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}
