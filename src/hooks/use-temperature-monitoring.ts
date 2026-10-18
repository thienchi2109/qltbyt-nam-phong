"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { callRpc } from "@/lib/rpc-client"
import type {
  TemperatureWorkspace,
  TemperatureReading,
  TemperatureDeviation,
} from "@/types/temperature-monitoring"

/** Scope every temperature cache entry to the current identity; SQL owns authorization. */
export function useTemperatureQuery<T>(fn: string, args: Record<string, unknown>, enabled = true) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: [
      "temperature-monitoring",
      session?.user?.id,
      session?.user?.role,
      session?.user?.don_vi,
      session?.user?.khoa_phong,
      fn,
      args,
    ],
    queryFn: ({ signal }) => callRpc<T>({ fn, args, signal }),
    enabled: enabled && !!session?.user?.id,
    staleTime: 15_000,
    refetchInterval: args.p_status === "current" ? 30_000 : false,
  })
}

/** Persist one operation, then refresh authoritative state and existing Equipment/notification caches. */
export function useTemperatureMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ fn, args }: { fn: string; args: Record<string, unknown> }) =>
      callRpc<TemperatureReading | TemperatureDeviation>({ fn, args }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["temperature-monitoring"] }),
        client.invalidateQueries({ queryKey: ["equipment_list_enhanced"] }),
        client.invalidateQueries({ queryKey: ["app-notification-counts"] }),
      ])
    },
  })
}

/** Fetch server-filtered slots with current-shift polling. */
export function useTemperatureWorkspace(args: Record<string, unknown>, enabled = true) {
  return useTemperatureQuery<TemperatureWorkspace>(
    "temperature_monitoring_workspace_list",
    args,
    enabled
  )
}
