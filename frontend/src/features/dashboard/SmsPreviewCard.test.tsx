import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { setLang } from '@/lib/i18n'
import type { SmsPreview } from '@/types/api'
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

beforeEach(() => setLang('en'))

describe('SmsPreviewCard', () => {
  it('starts with the Bengali SMS farmers get, and switches to English', async () => {
    render(<SmsPreviewCard sms={[en, bn]} />)
    expect(screen.getByRole('heading', { name: 'Today’s SMS alert' })).toBeInTheDocument()
    expect(screen.getByText(`New message: ${bn.text}`)).toBeInTheDocument()
    expect(screen.getByText('61 of 70 characters · 1 SMS')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(screen.getByText(/^New message: Haor Rice Field/)).toBeInTheDocument()
    expect(screen.getByText('69 of 160 characters · 1 SMS')).toBeInTheDocument()
  })

  it('counts a long message in SMS parts', () => {
    render(<SmsPreviewCard sms={[{ ...bn, length: 78, parts: 2 }]} />)
    expect(screen.getByText('78 characters · 2 SMS')).toBeInTheDocument()
  })

  it('stays quiet when nothing needs doing', () => {
    render(<SmsPreviewCard sms={[{ lang: 'bn', send: false, text: '', length: 0, parts: 0, single_limit: 0 }]} />)
    expect(screen.getByText(/No SMS today/)).toBeInTheDocument()
    expect(screen.getByText('No new messages')).toBeInTheDocument()
    expect(screen.queryByText(/ SMS$/)).not.toBeInTheDocument() // no length meter
  })

  it('speaks Bengali', () => {
    setLang('bn')
    render(<SmsPreviewCard sms={[en, bn]} />)
    expect(screen.getByRole('heading', { name: 'আজকের SMS সতর্কবার্তা' })).toBeInTheDocument()
    expect(screen.getByText('৭০টির মধ্যে ৬১টি অক্ষর · ১টি SMS')).toBeInTheDocument()
  })
})
