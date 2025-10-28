"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { callRpc } from "@/lib/rpc-client"
import { Skeleton } from "@/components/ui/skeleton"

interface TenantFilterDropdownProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TenantFilterDropdown({ 
  value, 
  onChange,
  className = ""
}: TenantFilterDropdownProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isGlobal = user?.role === 'global' || user?.role === 'admin'
  const isRegionalLeader = user?.role === 'regional_leader'

  // Load tenant options using TanStack Query
  // Use get_facilities_with_equipment_count for both global and regional_leader
  // This function automatically returns all facilities for global, region-scoped for regional_leader
  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<{ id: number; name: string; code?: string }[]>({
    queryKey: ['reports-facilities', user?.role, user?.don_vi],
    queryFn: async () => {
      if (isGlobal || isRegionalLeader) {
        // Both roles use get_facilities_with_equipment_count
        // Global: returns all facilities
        // Regional leader: returns region-scoped facilities
        const result = await callRpc<any>({ fn: 'get_facilities_with_equipment_count', args: {} })
        // Function returns JSONB array
        const list = Array.isArray(result) ? result : []
        return list.map((t: any) => ({ id: t.id, name: t.name, code: t.code }))
      }
      return []
    },
    enabled: isGlobal || isRegionalLeader,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: false,
  })

  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code?: string }[]

  const triggerId = React.useId()

  // Loading state
  if (isTenantsLoading) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Label htmlFor={triggerId} className="text-xs text-muted-foreground whitespace-nowrap leading-none">
          {isRegionalLeader ? 'Cơ sở' : 'Đơn vị'}
        </Label>
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  // Dynamic labels based on role
  const labelText = isRegionalLeader ? 'Cơ sở' : 'Đơn vị'
  const unsetText = isRegionalLeader ? '— Chọn cơ sở —' : '— Chọn đơn vị —'
  const allText = isRegionalLeader ? 'Tất cả cơ sở (vùng)' : 'Tất cả đơn vị'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Label htmlFor={triggerId} className="text-xs text-muted-foreground whitespace-nowrap leading-none">
        {labelText}
      </Label>
      <Select value={value} onValueChange={(v) => React.startTransition(() => onChange(v))}>
        <SelectTrigger
          id={triggerId}
          className="h-8 w-full"
        >
          <SelectValue placeholder={unsetText} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">{unsetText}</SelectItem>
          <SelectItem value="all">{allText}</SelectItem>
          {tenantOptions.map(t => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.name} {t.code ? `(${t.code})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

