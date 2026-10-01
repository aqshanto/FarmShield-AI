import { ArrowRight, Bell, Droplets, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/toast/useToast'
import { useText } from '@/lib/i18n'
import { Section } from './Section'

const text = {
  en: {
    eyebrow: 'Components',
    title: 'Buttons & feedback',
    description: 'Buttons lift on hover and squish when pressed. Every action answers back with a toast, so farmers always know it worked.',
    saved: 'Reminder saved',
    savedHint: 'We will remind you to irrigate at 6 AM.',
    saving: 'Saving…',
    save: 'Save irrigation reminder',
    view: 'View my farm',
    learn: 'Learn more',
    remove: 'Remove field',
    disabled: 'Disabled',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    tryToasts: 'Try the notifications:',
    success: 'Success',
    info: 'Info',
    warning: 'Warning',
    danger: 'Danger alert',
    toasts: {
      success: ['Crop looks healthy', 'Your rice field is growing well.'],
      info: ['New satellite data', 'Soil moisture updated 2 hours ago.'],
      warning: ['Dry days ahead', 'Plan irrigation for the next 5 days.'],
      danger: ['Flood alert', 'Heavy rain expected tonight. Move seedlings to higher ground.'],
    },
  },
  bn: {
    eyebrow: 'উপাদান',
    title: 'বোতাম ও সাড়া',
    description: 'মাউস রাখলে বোতাম একটু উঠে আসে, চাপলে দেবে যায়। প্রতিটি কাজের পর একটি বার্তা দেখায়, তাই কৃষক সবসময় জানেন কাজটি হয়েছে।',
    saved: 'মনে করিয়ে দেওয়া সংরক্ষিত',
    savedHint: 'সকাল ৬টায় সেচ দেওয়ার কথা মনে করিয়ে দেব।',
    saving: 'সংরক্ষণ হচ্ছে…',
    save: 'সেচের রিমাইন্ডার সংরক্ষণ করুন',
    view: 'আমার খামার দেখুন',
    learn: 'আরও জানুন',
    remove: 'জমি মুছুন',
    disabled: 'নিষ্ক্রিয়',
    small: 'ছোট',
    medium: 'মাঝারি',
    large: 'বড়',
    tryToasts: 'বিজ্ঞপ্তিগুলো চেষ্টা করুন:',
    success: 'সফল',
    info: 'তথ্য',
    warning: 'সতর্কতা',
    danger: 'বিপদের বার্তা',
    toasts: {
      success: ['ফসল সুস্থ দেখাচ্ছে', 'আপনার ধানক্ষেত ভালোভাবে বাড়ছে।'],
      info: ['উপগ্রহের নতুন তথ্য', 'মাটির আর্দ্রতা ২ ঘণ্টা আগে হালনাগাদ হয়েছে।'],
      warning: ['সামনে শুকনো দিন', 'আগামী ৫ দিনের সেচের পরিকল্পনা করুন।'],
      danger: ['বন্যার সতর্কতা', 'আজ রাতে ভারী বৃষ্টি হতে পারে। চারা উঁচু জায়গায় সরান।'],
    },
  },
}

export function ButtonSection() {
  const { toast } = useToast()
  const t = useText(text)
  const [saving, setSaving] = useState(false)

  const saveReminder = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ tone: 'success', title: t.saved, description: t.savedHint })
    }, 1400)
  }
  const show = (tone: keyof typeof t.toasts) => toast({ tone, title: t.toasts[tone][0], description: t.toasts[tone][1] })

  return (
    <Section id="buttons" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <Card className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Droplets className="size-4" />} loading={saving} onClick={saveReminder}>
            {saving ? t.saving : t.save}
          </Button>
          <Button variant="secondary" iconRight={<ArrowRight className="size-4" />}>
            {t.view}
          </Button>
          <Button variant="ghost">{t.learn}</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            {t.remove}
          </Button>
          <Button disabled>{t.disabled}</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{t.small}</Button>
          <Button size="md">{t.medium}</Button>
          <Button size="lg">{t.large}</Button>
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-medium text-ink-muted">{t.tryToasts}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => show('success')}>
              {t.success}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => show('info')}>
              {t.info}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => show('warning')}>
              {t.warning}
            </Button>
            <Button size="sm" variant="secondary" icon={<Bell className="size-4" />} onClick={() => show('danger')}>
              {t.danger}
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  )
}
