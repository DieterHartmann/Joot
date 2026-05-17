export interface HolidayEntry {
  date:        Date
  name:        string
  description: string | undefined
  countryCode: string
}

export interface HolidayProvider {
  readonly id: string
  fetch(countryCode: string, year: number): Promise<HolidayEntry[]>
}

class NagerDateProvider implements HolidayProvider {
  readonly id = 'nager_date'

  async fetch(countryCode: string, year: number): Promise<HolidayEntry[]> {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
    const res = await fetch(url)
    if (res.status === 404) throw new Error(`No holidays found for country "${countryCode}" in ${year}`)
    if (!res.ok)            throw new Error(`Nager.Date returned ${res.status} for ${countryCode}/${year}`)

    const data = await res.json() as Array<{
      date:      string
      localName: string
      name:      string
    }>

    return data.map(h => ({
      date:        new Date(h.date),
      name:        h.localName,
      description: h.name !== h.localName ? h.name : undefined,
      countryCode,
    }))
  }
}

export const providers: Record<string, HolidayProvider> = {
  nager_date: new NagerDateProvider(),
}
