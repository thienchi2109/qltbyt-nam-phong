"use client"
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"
import * as React from "react"

export type TenantBranding = {
  id: number
  name: string | null
  logo_url: string | null
}

export function useTenantBranding(overrideDonViId?: number | null) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isGlobal = (user?.role === 'global' || user?.role === 'admin')
  const tenantKey = user?.don_vi ? String(user.don_vi) : 'none'
  const effectiveTenantKey = isGlobal && overrideDonViId ? String(overrideDonViId) : tenantKey

  const query = useQuery<TenantBranding | null>({
    queryKey: ['tenant_branding', { tenant: effectiveTenantKey }],
    queryFn: async ({ signal }) => {
      const res = await callRpc<TenantBranding[] | null>({ fn: 'don_vi_branding_get', args: { p_id: overrideDonViId ?? null }, signal })
      const row = Array.isArray(res) ? res[0] : null
      return row ? { id: Number(row.id), name: row.name ?? null, logo_url: row.logo_url ?? null } : null
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Invalidate on tenant switch
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const onTenantSwitch = () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_branding'] })
    }
    window.addEventListener('tenant-switched', onTenantSwitch as EventListener)
    return () => window.removeEventListener('tenant-switched', onTenantSwitch as EventListener)
  }, [queryClient])

  return query
}
