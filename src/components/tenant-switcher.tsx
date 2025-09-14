"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Membership = { don_vi: number; name: string; code: string }

export function TenantSwitcher() {
  const { data: session, update } = useSession()
  const user: any = session?.user
  const [memberships, setMemberships] = React.useState<Membership[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/tenants/memberships")
        if (res.ok) {
          const data = await res.json()
          setMemberships(data.memberships || [])
        }
      } catch {}
    }
    load()
  }, [])

  const onSwitch = async (don_vi: number) => {
    if (!don_vi || loading) return
    try {
      setLoading(true)
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ don_vi })
      })
      if (res.ok) {
        await update()
      }
    } finally {
      setLoading(false)
    }
  }

  const current = user?.don_vi

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="touch-target-sm md:h-8 md:px-2">
          {current ? `Đơn vị #${current}` : "Chọn đơn vị"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Chuyển đơn vị</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.don_vi} onSelect={() => onSwitch(m.don_vi)}>
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground">{m.code || `ID ${m.don_vi}`}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
