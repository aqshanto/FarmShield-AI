import { ArrowRight, Bell, Droplets, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/toast/useToast'
import { Section } from './Section'

export function ButtonSection() {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const saveReminder = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ tone: 'success', title: 'Reminder saved', description: 'We will remind you to irrigate at 6 AM.' })
    }, 1400)
  }

  return (
    <Section
      id="buttons"
      eyebrow="Components"
      title="Buttons & feedback"
      description="Buttons lift on hover and squish when pressed. Every action answers back with a toast, so farmers always know it worked."
    >
      <Card className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Droplets className="size-4" />} loading={saving} onClick={saveReminder}>
            {saving ? 'Saving…' : 'Save irrigation reminder'}
          </Button>
          <Button variant="secondary" iconRight={<ArrowRight className="size-4" />}>
            View my farm
          </Button>
          <Button variant="ghost">Learn more</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            Remove field
          </Button>
          <Button disabled>Disabled</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-medium text-ink-muted">Try the notifications:</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => toast({ tone: 'success', title: 'Crop looks healthy', description: 'Your rice field is growing well.' })}>
              Success
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ tone: 'info', title: 'New satellite data', description: 'Soil moisture updated 2 hours ago.' })}>
              Info
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ tone: 'warning', title: 'Dry days ahead', description: 'Plan irrigation for the next 5 days.' })}>
              Warning
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Bell className="size-4" />}
              onClick={() => toast({ tone: 'danger', title: 'Flood alert', description: 'Heavy rain expected tonight. Move seedlings to higher ground.' })}
            >
              Danger alert
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  )
}
