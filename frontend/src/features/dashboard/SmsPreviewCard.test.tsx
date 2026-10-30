import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { setLang } from '@/lib/i18n'
import type { SmsLogEntry, SmsPreview, SmsStatus } from '@/types/api'
import { SmsPreviewCard } from './SmsPreviewCard'

const bn: SmsPreview = { lang: 'bn', send: true, text: 'আজই ব্যবস্থা নিন: বন্যার ঝুঁকি বেশি। পাকা ধান এখনই কেটে ফেলুন।', length: 61, parts: 1, single_limit: 70 }
const en: SmsPreview = {
  lang: 'en',
  send: true,
  text: 'Haor Rice Field\nAct today: flood risk is high. Harvest ripe rice now.',
  length: 69,
  parts: 1,
  single_limit: 160,
}

let status: SmsStatus
let log: SmsLogEntry[]
let sends: string[]

beforeEach(() => {
  setLang('en')
  status = { real_sending: false, phones: 0, sent_today: 0, daily_limit: 10 }
  log = [
    { day: '2026-10-30', channel: 'daily', status: 'alert', text: bn.text, detail: null, created_at: '2026-10-30T03:00:00Z' },
    { day: '2026-10-29', channel: 'daily', status: 'quiet', text: '', detail: null, created_at: '2026-10-29T03:00:00Z' },
  ]
  sends = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code })
    if (url === '/api/v1/sms/status') return json(status)
    if (url.startsWith('/api/v1/sms/history/haor')) return json(log)
    if (url.startsWith('/api/v1/sms/send/haor') && init?.method === 'POST') {
      sends.push(url)
      log = [{ ...log[0], channel: 'real', status: 'sent', detail: '2 sent, 0 failed', created_at: '2026-10-30T05:00:00Z' }, ...log]
      status = { ...status, sent_today: 2 }
      return json({ sent: 2, failed: 0, message: 'Sent to 2 phones.' })
    }
    return json({ detail: 'not found' }, 404)
  })
})

const show = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>)

describe('SmsPreviewCard', () => {
  it('starts with the Bengali SMS farmers get, and switches to English', async () => {
    show(<SmsPreviewCard farmId="haor" sms={[en, bn]} />)
    expect(screen.getByRole('heading', { name: 'Today’s SMS alert' })).toBeInTheDocument()
    expect(screen.getByText(`New message: ${bn.text}`)).toBeInTheDocument()
    expect(screen.getByText('61 of 70 characters · 1 SMS')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(screen.getByText(/^New message: Haor Rice Field/)).toBeInTheDocument()
    expect(screen.getByText('69 of 160 characters · 1 SMS')).toBeInTheDocument()
  })

  it('counts a long message in SMS parts', () => {
    show(<SmsPreviewCard farmId="haor" sms={[{ ...bn, length: 78, parts: 2 }]} />)
    expect(screen.getByText('78 characters · 2 SMS')).toBeInTheDocument()
  })

  it('stays quiet when nothing needs doing', () => {
    show(<SmsPreviewCard farmId="haor" sms={[{ lang: 'bn', send: false, text: '', length: 0, parts: 0, single_limit: 0 }]} />)
    expect(screen.getByText(/No SMS today/)).toBeInTheDocument()
    expect(screen.getByText('No new messages')).toBeInTheDocument()
    expect(screen.queryByText(/ SMS$/)).not.toBeInTheDocument() // no length meter
  })

  it('shows the automatic daily log, and says when real sending is not set up', async () => {
    show(<SmsPreviewCard farmId="haor" sms={[en, bn]} />)
    const section = screen.getByRole('region', { name: 'Automatic SMS log' })
    expect(await within(section).findByText('SMS due')).toBeInTheDocument()
    expect(within(section).getByText('No SMS needed')).toBeInTheDocument()
    expect(within(section).getByText('Nothing needed action that day.')).toBeInTheDocument()
    expect(within(section).getByText(/Twilio is set up/)).toBeInTheDocument()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })

  it('texts the team phones and logs the send', async () => {
    status = { real_sending: true, phones: 2, sent_today: 0, daily_limit: 10 }
    show(<SmsPreviewCard farmId="haor" sms={[en, bn]} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Send to our 2 team phones' }))

    expect(sends).toEqual(['/api/v1/sms/send/haor?lang=bn'])
    expect(await screen.findByText('SMS sent')).toBeInTheDocument()
    expect(await screen.findByText('Sent to phones')).toBeInTheDocument()
    expect(await screen.findByText('2 of 10 real SMS used today')).toBeInTheDocument()
  })

  it('cannot send on a quiet day', async () => {
    status = { real_sending: true, phones: 1, sent_today: 0, daily_limit: 10 }
    show(<SmsPreviewCard farmId="haor" sms={[{ lang: 'bn', send: false, text: '', length: 0, parts: 0, single_limit: 0 }]} />)
    expect(await screen.findByRole('button', { name: 'Send to our 1 team phone' })).toBeDisabled()
  })

  it('speaks Bengali', () => {
    setLang('bn')
    show(<SmsPreviewCard farmId="haor" sms={[en, bn]} />)
    expect(screen.getByRole('heading', { name: 'আজকের SMS সতর্কবার্তা' })).toBeInTheDocument()
    expect(screen.getByText('৭০টির মধ্যে ৬১টি অক্ষর · ১টি SMS')).toBeInTheDocument()
  })
})
