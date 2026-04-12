'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/lib/supabase/types'

const STORAGE_KEY = 'mugdm_selected_business_id'

interface BusinessContextValue {
  businessId: string | null
  businesses: Business[]
  currentBusiness: Business | null
  switchBusiness: (id: string) => void
  isLoading: boolean
}

const BusinessContext = createContext<BusinessContextValue>({
  businessId: null,
  businesses: [],
  currentBusiness: null,
  switchBusiness: () => {},
  isLoading: true,
})

function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadBusinesses() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        const { data: bizList } = (await supabase
          .from('businesses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })) as unknown as {
          data: Business[] | null
        }

        const list = bizList ?? []
        setBusinesses(list)

        if (list.length > 0) {
          // Restore from localStorage or default to first
          const stored =
            typeof window !== 'undefined'
              ? localStorage.getItem(STORAGE_KEY)
              : null
          const match = stored ? list.find((b) => b.id === stored) : null
          setBusinessId(match ? match.id : list[0].id)
        }
      } catch {
        // Silently fail — pages will show empty state
      } finally {
        setIsLoading(false)
      }
    }

    loadBusinesses()
  }, [])

  const switchBusiness = useCallback(
    (id: string) => {
      const match = businesses.find((b) => b.id === id)
      if (match) {
        setBusinessId(id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, id)
        }
      }
    },
    [businesses]
  )

  const currentBusiness = businesses.find((b) => b.id === businessId) ?? null

  return (
    <BusinessContext.Provider
      value={{ businessId, businesses, currentBusiness, switchBusiness, isLoading }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

function useBusiness() {
  return useContext(BusinessContext)
}

export { BusinessContext, BusinessProvider, useBusiness }
