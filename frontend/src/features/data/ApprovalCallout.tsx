import { ExternalLink, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useText } from '@/lib/i18n'

// Token accepted, but an archive (GES DISC for GPM) needs its terms approved once.
const text = {
  en: {
    and: ' and ',
    title: (m: string) => `One click left for ${m}`,
    body: (m: string) =>
      `Your Earthdata token works (SMAP data is flowing). NASA’s archive for ${m} also asks you to accept its data terms once. Until then, NASA POWER stands in.`,
    open: 'Open the approval page',
    approve: 'and approve',
    back: 'Come back and press “Refresh from NASA”. No new token is needed.',
  },
  bn: {
    and: ' ও ',
    title: (m: string) => `${m}-এর জন্য আর একটি ক্লিক বাকি`,
    body: (m: string) =>
      `আপনার Earthdata টোকেন কাজ করছে (SMAP-এর তথ্য আসছে)। ${m}-এর জন্য নাসার আর্কাইভ একবার তাদের তথ্য-শর্ত মেনে নিতে বলে। ততক্ষণ NASA POWER বিকল্প হিসেবে কাজ করবে।`,
    open: 'অনুমোদনের পাতা খুলুন',
    approve: 'আর অনুমোদন দিন',
    back: 'ফিরে এসে “নাসা থেকে হালনাগাদ” চাপুন। নতুন টোকেন লাগবে না।',
  },
}

export function ApprovalCallout({ links }: { links: { mission: string; url: string }[] }) {
  const t = useText(text)
  if (!links.length) return null
  const [first] = links
  const missions = [...new Set(links.map((l) => l.mission))].join(t.and)
  return (
    <Card className="border-harvest-300/30 bg-harvest-400/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-harvest-400/15 text-harvest-300">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-ink">{t.title(missions)}</h2>
          <p className="text-sm text-ink-muted">{t.body(missions)}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              <a href={first.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-leaf-300 underline-offset-2 hover:underline">
                {t.open} <ExternalLink className="size-3" aria-hidden="true" />
              </a>{' '}
              {t.approve} <span className="font-semibold text-ink">NASA GESDISC DATA ARCHIVE</span>.
            </li>
            <li>{t.back}</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}
