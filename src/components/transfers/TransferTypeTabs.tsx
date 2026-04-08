"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import type { TransferType } from "@/types/transfers-data-grid"

export interface TransferTypeTabsProps {
  /** Active tab value */
  activeTab: TransferType
  /** Callback when tab changes */
  onTabChange: (tab: TransferType) => void
  /** Badge counts per transfer type */
  counts?: {
    noi_bo?: number
    ben_ngoai?: number
    thanh_ly?: number
  }
  /** Content to render for each tab */
  children: React.ReactNode
}

const TRANSFER_TYPE_CONFIGS = [
  {
    value: 'noi_bo' as const,
    label: 'Nội bộ',
    description: 'Luân chuyển giữa các khoa phòng',
  },
  {
    value: 'ben_ngoai' as const,
    label: 'Bên ngoài',
    description: 'Cho mượn đơn vị bên ngoài',
  },
  {
    value: 'thanh_ly' as const,
    label: 'Thanh lý',
    description: 'Thanh lý thiết bị',
  },
] as const

/**
 * Tab navigation for transfer types with URL-based state management
 *
 * Features:
 * - 3 tabs: Internal (noi_bo), External (ben_ngoai), Liquidation (thanh_ly)
 * - URL query param persistence (?tab=noi_bo)
 * - Badge counts per type
 * - Accessible keyboard navigation
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState<TransferType>('noi_bo')
 *
 * <TransferTypeTabs
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   counts={{ noi_bo: 10, ben_ngoai: 5, thanh_ly: 2 }}
 * >
 *   <div>Your grid content here</div>
 * </TransferTypeTabs>
 * ```
 */
export function TransferTypeTabs({
  activeTab,
  onTabChange,
  counts,
  children,
}: TransferTypeTabsProps) {
  // Note: URL synchronization is handled by the useTransferTypeTab hook
  // The onTabChange callback (from the hook) already handles router.push
  const handleTabChange = React.useCallback((value: string) => {
    const newTab = value as TransferType
    onTabChange(newTab)
  }, [onTabChange])

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        {TRANSFER_TYPE_CONFIGS.map((config) => (
          <TabsTrigger
            key={config.value}
            value={config.value}
            className="relative"
          >
            <span className="flex items-center gap-2">
              {config.label}
              {counts?.[config.value] !== undefined && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[20px] px-1 text-xs"
                >
                  {counts[config.value]}
                </Badge>
              )}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Single content area - parent component handles conditional rendering */}
      <TabsContent value={activeTab} className="mt-4">
        {children}
      </TabsContent>
    </Tabs>
  )
}

/**
 * Hook to manage transfer type tab state with URL synchronization
 *
 * @param defaultTab - Default tab if no URL param exists
 * @returns Current active tab and setter function
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useTransferTypeTab('noi_bo')
 * ```
 */
export function useTransferTypeTab(
  defaultTab: TransferType = 'noi_bo'
): [TransferType, (tab: TransferType) => void] {
  const router = useRouter()
  const readTabFromLocation = React.useCallback(() => {
    if (typeof window === "undefined") {
      return defaultTab
    }

    const tabParam = new URLSearchParams(window.location.search).get("tab")
    if (tabParam === "noi_bo" || tabParam === "ben_ngoai" || tabParam === "thanh_ly") {
      return tabParam
    }

    return defaultTab
  }, [defaultTab])

  const [activeTab, setActiveTab] = React.useState<TransferType>(() => readTabFromLocation())

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const syncTabFromLocation = () => {
      setActiveTab(readTabFromLocation())
    }

    syncTabFromLocation()
    window.addEventListener("popstate", syncTabFromLocation)

    return () => {
      window.removeEventListener("popstate", syncTabFromLocation)
    }
  }, [readTabFromLocation])

  const handleSetTab = React.useCallback((tab: TransferType) => {
    setActiveTab(tab)

    const params = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    )
    params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router])

  return [activeTab, handleSetTab]
}

/**
 * Get transfer type config by value
 */
function getTransferTypeConfig(type: TransferType) {
  return TRANSFER_TYPE_CONFIGS.find(config => config.value === type)
}
