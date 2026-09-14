"use client"

import * as React from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Users } from "lucide-react"
import type { Session } from "next-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { isGlobalRole } from "@/lib/rbac"
import {
  displayRecipientName,
  getEffectiveDonVi,
  isRecipientConfigRole,
  parseCandidatesPayload,
  parseConfigPayload,
  recipientMapFromConfig,
  readResponse,
  selectedRecipientNames,
  type Candidate,
  type Recipient,
} from "./NotificationsRecipientPickerTypes"

/** Exposes recipient configuration only for roles authorized by the existing API. */
export function NotificationsRecipientPicker({ user }: { user: Session["user"] }) {
  const { selectedFacilityId, showSelector } = useTenantSelection()
  if (!isRecipientConfigRole(user.role)) return null
  const global = isGlobalRole(user.role)
  const target = global
    ? selectedFacilityId
      ? String(selectedFacilityId)
      : null
    : getEffectiveDonVi(user)
  const scope = JSON.stringify([user.id, user.role, getEffectiveDonVi(user), target])
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" aria-hidden="true" />
          Người nhận thông báo
        </CardTitle>
        {global && showSelector ? <TenantSelector hideAllOption /> : null}
      </CardHeader>
      <CardContent>
        {target ? (
          <RecipientEditor key={scope} target={target} scope={scope} />
        ) : (
          <p role="status">Chọn một đơn vị cụ thể để tải cấu hình người nhận.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Keeps the editable draft separate from server state and scoped to one caller/target. */
function RecipientEditor({ target, scope }: { target: string; scope: string }) {
  const client = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [draft, setDraft] = React.useState<Record<string, Recipient> | null>(null)
  const configKey = ["web-push", scope, "config"]
  const config = useQuery({
    queryKey: configKey,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    queryFn: async ({ signal }) => {
      const payload = await readResponse(
        await fetch(`/api/web-push/config?don_vi_id=${target}`, { signal })
      )
      const recipients = parseConfigPayload(payload, target)
      if (!recipients) throw new Error("invalid_response")
      return recipients
    },
  })
  const candidates = useInfiniteQuery<
    { candidates: Candidate[]; nextCursor: string | null },
    Error,
    {
      pages: Array<{ candidates: Candidate[]; nextCursor: string | null }>
      pageParams: Array<string | null>
    },
    string[],
    string | null
  >({
    queryKey: ["web-push", scope, "candidates", search],
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    queryFn: async ({ signal, pageParam }) => {
      const query = new URLSearchParams({ don_vi_id: target, q: search, limit: "50" })
      if (pageParam) query.set("cursor", pageParam)
      const payload = await readResponse(
        await fetch(`/api/web-push/candidates?${query}`, { signal })
      )
      const page = parseCandidatesPayload(payload, target)
      if (!page) throw new Error("invalid_response")
      return page
    },
  })
  const selected = draft ?? recipientMapFromConfig(config.data ?? [])
  const save = useMutation({
    retry: false,
    mutationFn: async (usernames: string) => {
      const payload = await readResponse(
        await fetch("/api/web-push/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, don_vi_id: target, usernames, self_action: "none" }),
        })
      )
      const recipients = parseConfigPayload(payload, target)
      if (!recipients) throw new Error("invalid_response")
      return recipients
    },
    onSuccess: async (recipients) => {
      await client.cancelQueries({ queryKey: configKey, exact: true })
      client.setQueryData(configKey, recipients)
      // The atomic PUT returns full config; mark stale without overwriting it with a second GET.
      await client.invalidateQueries({ queryKey: configKey, exact: true, refetchType: "none" })
    },
  })
  const ready = config.isSuccess && !config.isFetching && !save.isPending
  const options = [
    ...new Map(
      candidates.data?.pages
        .flatMap((page) => page.candidates)
        .map((candidate) => [candidate.user_id, candidate])
    ).values(),
  ]
  const absent = Object.values(selected).filter(
    (recipient) => !options.some((candidate) => candidate.user_id === recipient.user_id)
  )
  const toggle = (candidate: Candidate) => {
    if (!ready || selected[candidate.user_id]?.protected) return
    const next = { ...selected }
    if (next[candidate.user_id]) delete next[candidate.user_id]
    else
      next[candidate.user_id] = {
        ...candidate,
        status: "eligible",
        protected: false,
        editable: true,
      }
    setDraft(next)
    save.reset()
  }
  const reload = () => {
    // Preserve local edits (including an empty selection) when reload fails or recovers.
    setDraft(selected)
    save.reset()
    void config.refetch()
  }
  return (
    <div className="space-y-4">
      {config.isFetching ? <p role="status">Đang tải cấu hình người nhận...</p> : null}
      {config.isError ? (
        <p role="alert">Không thể tải cấu hình người nhận. Vui lòng thử lại.</p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="recipient-search">Tìm tài khoản</Label>
        <Input
          id="recipient-search"
          type="search"
          role="searchbox"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo họ tên hoặc username"
        />
      </div>
      <p aria-live="polite">Đã chọn: {Object.keys(selected).length}</p>
      {absent.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Đang cấu hình</h3>
          {absent.map((recipient) => (
            <div
              key={recipient.user_id}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <span className="break-words">{displayRecipientName(recipient)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {candidates.isError ? (
        <div className="space-y-2">
          <p role="alert">Không thể tải danh sách tài khoản trong phạm vi được phép.</p>
          <Button variant="outline" onClick={() => void candidates.refetch()}>
            Thử lại tìm kiếm
          </Button>
        </div>
      ) : null}
      {candidates.isFetching ? <p role="status">Đang tải tài khoản...</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((candidate) => (
          <label
            key={candidate.user_id}
            className="flex items-center gap-3 rounded-md border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={Boolean(selected[candidate.user_id])}
              disabled={!ready || Boolean(selected[candidate.user_id]?.protected)}
              onChange={() => toggle(candidate)}
              aria-label={displayRecipientName(candidate)}
            />
            <span className="min-w-0 break-words">{displayRecipientName(candidate)}</span>
          </label>
        ))}
      </div>
      {candidates.isSuccess && options.length === 0 ? (
        <p role="status">Không có tài khoản phù hợp trong phạm vi đơn vị này.</p>
      ) : null}
      {candidates.hasNextPage ? (
        <Button
          variant="outline"
          disabled={candidates.isFetching}
          onClick={() => void candidates.fetchNextPage()}
        >
          Tải thêm tài khoản
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={reload}
          disabled={config.isFetching || save.isPending}
        >
          Tải lại cấu hình
        </Button>
        <Button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (ready)
              save.mutate(selectedRecipientNames(selected), { onSuccess: () => setDraft(null) })
          }}
        >
          {save.isPending ? "Đang lưu..." : "Lưu người nhận"}
        </Button>
      </div>
      {save.isError ? (
        <p role="alert">
          Không thể xác nhận lưu danh sách người nhận. Vui lòng tải lại cấu hình để kiểm tra trước
          khi thử lại.
        </p>
      ) : null}
      {save.isSuccess ? <p role="status">Đã lưu danh sách người nhận.</p> : null}
    </div>
  )
}
