import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MyFarm } from '@/lib/myFarms'
import { farmsFixture, makeDashboard } from '@/test/fixtures'
import { useMyMapFarms } from './useMyMapFarms'

const field: MyFarm = {
  id: 'my_25.5710_88.7649_maize',
  name: 'North maize field',
  cropId: 'maize',
  cropName: 'Maize',
  cropNameBn: 'ভুট্টা',
  lat: 25.571,
  lon: 88.7649,
  district: 'Dinajpur',
  districtBn: 'দিনাজপুর',
  division: 'Rangpur',
  addedAt: '2026-10-01T00:00:00Z',
}

describe('useMyMapFarms', () => {
  it('turns saved fields into map farms with today’s levels', async () => {
    const dashboard = makeDashboard({ ...farmsFixture[0], id: field.id, name: field.name })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(dashboard)))
    const mine = [field]
    const { result } = renderHook(() => useMyMapFarms(mine))
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0]).toMatchObject({ id: field.id, name: field.name, overall: { level: 'danger' } })
  })
})
