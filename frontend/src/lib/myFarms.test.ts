import { beforeEach, describe, expect, it } from 'vitest'
import { isMyFarmId, type MyFarm, myFarmId, myFarms } from './myFarms'

const field = (id: string, name = 'Field'): Omit<MyFarm, 'addedAt'> => ({
  id,
  name,
  cropId: 'maize',
  cropName: 'Maize',
  cropNameBn: 'ভুট্টা',
  lat: 25.571,
  lon: 88.7649,
  district: 'Dinajpur',
  districtBn: 'দিনাজপুর',
  division: 'Rangpur',
})

beforeEach(() => {
  localStorage.clear()
  myFarms.reset()
})

describe('myFarms', () => {
  it('builds ids the API understands', () => {
    expect(myFarmId(25.57104, 88.76491, 'maize')).toBe('my_25.5710_88.7649_maize')
    expect(isMyFarmId('my_25.5710_88.7649_maize')).toBe(true)
    expect(isMyFarmId('sunamganj-haor')).toBe(false)
  })

  it('saves newest first, updates the same field, renames and removes', () => {
    myFarms.save(field('my_1.0000_2.0000_maize', 'North'))
    myFarms.save(field('my_3.0000_4.0000_wheat', 'South'))
    expect(myFarms.list().map((f) => f.name)).toEqual(['South', 'North'])

    myFarms.save(field('my_1.0000_2.0000_maize', 'North again'))
    expect(myFarms.list().map((f) => f.name)).toEqual(['North again', 'South'])

    myFarms.rename('my_3.0000_4.0000_wheat', '  Riverside  ')
    myFarms.rename('my_3.0000_4.0000_wheat', '   ') // blank keeps the old name
    expect(myFarms.get('my_3.0000_4.0000_wheat')?.name).toBe('Riverside')

    myFarms.remove('my_1.0000_2.0000_maize')
    expect(myFarms.list()).toHaveLength(1)

    // Survives a reload
    myFarms.reset()
    expect(myFarms.list()[0]).toMatchObject({ name: 'Riverside', addedAt: expect.any(String) })
  })

  it('ignores corrupt or foreign storage', () => {
    localStorage.setItem('farmshield-my-farms', '{not json')
    expect(myFarms.list()).toEqual([])
    myFarms.reset()
    localStorage.setItem('farmshield-my-farms', JSON.stringify([{ id: 'sunamganj-haor' }, null, { id: 'my_1.0000_2.0000_maize', name: 'x' }]))
    expect(myFarms.list().map((f) => f.id)).toEqual(['my_1.0000_2.0000_maize'])
  })
})
