"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { callRpc } from "@/lib/rpc-client"

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
  // Load tenant options using TanStack Query (same pattern as Equipment page)
  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ['tenant_list'],
    queryFn: async () => {
      const list = await callRpc<any[]>({ fn: 'tenant_list', args: {} })
      return (list || []).map((t: any) => ({ id: t.id, name: t.name, code: t.code }))
    },
    staleTime: 300_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: false,
  })

  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code: string }[]

  const triggerId = React.useId()

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Label htmlFor={triggerId} className="text-xs text-muted-foreground whitespace-nowrap leading-none">
        Đơn vị
      </Label>
      <Select value={value} onValueChange={(v) => React.startTransition(() => onChange(v))}>
        <SelectTrigger
          id={triggerId}
          className="h-8 w-full sm:w-[320px]"
          disabled={isTenantsLoading}
        >
          <SelectValue placeholder="— Chọn đơn vị —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">— Chọn đơn vị —</SelectItem>
          <SelectItem value="all">Tất cả đơn vị</SelectItem>
          {isTenantsLoading ? (
            <SelectItem value="__loading" disabled>Đang tải danh sách đơn vị...</SelectItem>
          ) : (
            tenantOptions.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} {t.code ? `(${t.code})` : ''}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

