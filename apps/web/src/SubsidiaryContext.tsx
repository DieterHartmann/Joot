import { createContext, useContext, useEffect, useState } from 'react'
import { getSubsidiaries, getSubsidiary, type Subsidiary } from './api'
import { useAuth } from './auth'

interface SubsidiaryContextValue {
  subsidiaryId: string | null
  subsidiary: Subsidiary | null
  subsidiaries: Subsidiary[]
  setSubsidiaryId: (id: string) => void
}

const SubsidiaryContext = createContext<SubsidiaryContextValue>({
  subsidiaryId: null,
  subsidiary: null,
  subsidiaries: [],
  setSubsidiaryId: () => {},
})

export function SubsidiaryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [ownSubsidiary, setOwnSubsidiary] = useState<Subsidiary | null>(null)

  useEffect(() => {
    if (!user) return
    if (user.role === 'holding_admin') {
      getSubsidiaries().then(data => {
        setSubsidiaries(data)
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
      })
    } else if (user.subsidiaryId) {
      setSelectedId(user.subsidiaryId)
      getSubsidiary(user.subsidiaryId).then(s => setOwnSubsidiary(s))
    }
  }, [user?.id])

  const subsidiary = user?.role === 'holding_admin'
    ? (subsidiaries.find(s => s.id === selectedId) ?? null)
    : ownSubsidiary

  return (
    <SubsidiaryContext.Provider value={{
      subsidiaryId: selectedId,
      subsidiary,
      subsidiaries,
      setSubsidiaryId: setSelectedId,
    }}>
      {children}
    </SubsidiaryContext.Provider>
  )
}

export const useSubsidiary = () => useContext(SubsidiaryContext)
