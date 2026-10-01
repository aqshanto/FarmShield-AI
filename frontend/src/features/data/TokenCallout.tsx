import { ExternalLink, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useText } from '@/lib/i18n'

// How to switch GPM and SMAP from the NASA POWER stand-in to the missions' own data.
const text = {
  en: {
    title: 'Unlock GPM and SMAP measurements',
    body: 'Rainfall and soil moisture are coming from NASA POWER right now. With a free NASA Earthdata token, FarmShield reads them straight from the GPM and SMAP missions.',
    create: 'Create an account at',
    choose: 'and choose',
    generate: 'Generate Token',
    add: 'Add it to',
    as: 'as',
    restart: 'Restart the backend, then press “Refresh from NASA”.',
  },
  bn: {
    title: 'GPM আর SMAP-এর তথ্য চালু করুন',
    body: 'এখন বৃষ্টি আর মাটির আর্দ্রতার তথ্য আসছে NASA POWER থেকে। বিনামূল্যের NASA Earthdata টোকেন দিলে ফার্মশিল্ড সরাসরি GPM আর SMAP মিশন থেকে তথ্য পড়বে।',
    create: 'এখানে অ্যাকাউন্ট খুলুন:',
    choose: 'তারপর বেছে নিন',
    generate: 'Generate Token',
    add: 'টোকেনটি যোগ করুন',
    as: 'ফাইলে এভাবে:',
    restart: 'ব্যাকএন্ড আবার চালু করে “নাসা থেকে হালনাগাদ” চাপুন।',
  },
}

export function TokenCallout() {
  const t = useText(text)
  return (
    <Card className="border-harvest-300/30 bg-harvest-400/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-harvest-400/15 text-harvest-300">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-ink">{t.title}</h2>
          <p className="text-sm text-ink-muted">{t.body}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              {t.create}{' '}
              <a
                href="https://urs.earthdata.nasa.gov/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-leaf-300 underline-offset-2 hover:underline"
              >
                urs.earthdata.nasa.gov <ExternalLink className="size-3" aria-hidden="true" />
              </a>{' '}
              {t.choose} <span className="font-semibold text-ink">{t.generate}</span>.
            </li>
            <li>
              {t.add} <code className="rounded bg-black/30 px-1">backend/.env</code> {t.as}{' '}
              <code className="rounded bg-black/30 px-1">EARTHDATA_TOKEN=…</code>
            </li>
            <li>{t.restart}</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}
