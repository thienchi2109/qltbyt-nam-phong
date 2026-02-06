"use client"
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { isGlobalRole } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import * as React from "react"

export type TenantBranding = {
  id: number
  name: string | null
  logo_url: string | null
}

export function useTenantBranding(options?: {
  formTenantId?: number | null,
  useFormContext?: boolean
}) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPrivileged = isGlobalRole(user?.role)
  
  // Determine effective tenant ID based on user privilege and options
  const sessionTenantKey = user?.don_vi ? String(user.don_vi) : 'none'
  const formTenantKey = options?.formTenantId ? String(options.formTenantId) : null
  
  // Smart tenant selection logic
  let effectiveTenantKey: string
  let rpcTenantId: number | null
  
  if (options?.useFormContext && options?.formTenantId && isPrivileged) {
    // Static branding: privileged user viewing specific tenant's form
    effectiveTenantKey = formTenantKey!
    rpcTenantId = options.formTenantId
  } else if (options?.formTenantId && !isPrivileged) {
    // Security: non-privileged users can only see their own tenant
    effectiveTenantKey = sessionTenantKey
    rpcTenantId = user?.don_vi || null
  } else {
    // Dynamic branding: session-based (current behavior)
    effectiveTenantKey = sessionTenantKey
    rpcTenantId = user?.don_vi || null
  }

  const query = useQuery<TenantBranding | null>({
    queryKey: ['tenant_branding', { tenant: effectiveTenantKey }],
    queryFn: async ({ signal }) => {
      const res = await callRpc<TenantBranding[] | null>({ 
        fn: 'don_vi_branding_get', 
        args: { p_id: rpcTenantId }, 
        signal 
      })
      const row = Array.isArray(res) ? res[0] : null
      return row ? { 
        id: Number(row.id), 
        name: row.name ?? null, 
        logo_url: row.logo_url ?? null 
      } : null
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
