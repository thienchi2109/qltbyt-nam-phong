"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTemperatureConfiguration } from "@/hooks/use-temperature-configuration"
import type { Equipment } from "@/types/database"
import { EquipmentDetailTemperatureStaffFields } from "./EquipmentDetailTemperatureStaffFields"

/** Mount only in the temperature tab; recording remains on its dedicated page. */
export function EquipmentDetailTemperatureTab({
  displayEquipment,
  isEditing,
}: {
  displayEquipment: Equipment
  isEditing: boolean
}): React.ReactNode {
  const configuration = useTemperatureConfiguration(displayEquipment.id, isEditing)
  const id = React.useId()
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null)
  const [openSelector, setOpenSelector] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!openSelector) return
    // ponytail: Independent installed Radix layer stacks; remove when dependencies share one stack.
    const dismissSelector = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setOpenSelector(null)
    }
    window.addEventListener("keydown", dismissSelector, true)
    return () => window.removeEventListener("keydown", dismissSelector, true)
  }, [openSelector])
  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    // Keep selector focus inside the dialog even with separately bundled Radix focus scopes.
    if (node) setPortalContainer(node.closest<HTMLElement>('[role="dialog"]') ?? node)
  }, [])
  const {
    showSection,
    display,
    suggestedEffectiveFromLocal,
    manager,
    message,
    reportInvalid,
    choices,
    mutation,
    summary,
    save,
  } = configuration
  if (isEditing) return null

  return (
    <ScrollArea className="h-full pr-4">
      <div ref={containerRef} className="min-w-0 space-y-4 py-4">
        {summary.error && (
          <p role="alert">
            Không tải được tóm tắt nhiệt độ.
            <Button onClick={() => void summary.refetch()}>Thử lại</Button>
          </p>
        )}
        {showSection && (
          <section className="min-w-0 space-y-4">
            <h3 className="text-base font-semibold">Theo dõi nhiệt độ</h3>
            <dl className="space-y-4">
              <div className="grid gap-2">
                <dt className="text-xs font-medium text-muted-foreground">Cấu hình theo dõi</dt>
                <dd className="break-words text-base font-medium tabular-nums">
                  {display.summary}
                </dd>
              </div>
              {display.enabled && (
                <div className="grid gap-2">
                  <dt className="text-xs font-medium text-muted-foreground">Phân công</dt>
                  <dd className="break-words text-base font-medium">{display.responsible}</dd>
                </div>
              )}
            </dl>
            {display.enabled && (
              <Button variant="outline" asChild>
                <Link href={`/temperature-monitoring?equipment=${displayEquipment.id}`}>
                  Mở sổ nhiệt độ
                </Link>
              </Button>
            )}
            {manager && choices.isPending && <p role="status">Đang tải cấu hình…</p>}
            {manager && choices.error && (
              <p role="alert">
                Không tải được cấu hình.
                <Button onClick={() => void choices.refetch()}>Thử lại</Button>
              </p>
            )}
            {manager && choices.data && (
              <form
                key={`${displayEquipment.id}-${choices.data.server_now}`}
                onInvalid={reportInvalid}
                onSubmit={(event) => {
                  event.preventDefault()
                  void save(new FormData(event.currentTarget))
                }}
                className="min-w-0 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-enabled`}
                    name="enabled"
                    type="checkbox"
                    defaultChecked={display.enabled}
                  />
                  <Label htmlFor={`${id}-enabled`}>Bật theo dõi nhiệt độ</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Phiên bản mới có hiệu lực theo khoảng thời gian. Số đo cũ giữ nguyên cấu hình tại
                  đầu ca.
                </p>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 grid gap-2">
                    <Label htmlFor={`${id}-from`}>Từ (giờ thiết bị)</Label>
                    <Input
                      id={`${id}-from`}
                      type="datetime-local"
                      step={1}
                      value={suggestedEffectiveFromLocal}
                      readOnly
                      className="min-w-0 max-w-full"
                    />
                  </div>
                  <div className="min-w-0 grid gap-2">
                    <Label htmlFor={`${id}-to`}>Đến (tùy chọn)</Label>
                    <Input
                      id={`${id}-to`}
                      name="to"
                      type="datetime-local"
                      className="min-w-0 max-w-full"
                    />
                  </div>
                  <div className="min-w-0 grid gap-2">
                    <Label htmlFor={`${id}-lower`}>Ngưỡng dưới °C</Label>
                    <Input
                      id={`${id}-lower`}
                      name="lower"
                      type="number"
                      step="0.1"
                      defaultValue={display.lower}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="min-w-0 grid gap-2">
                    <Label htmlFor={`${id}-upper`}>Ngưỡng trên °C</Label>
                    <Input
                      id={`${id}-upper`}
                      name="upper"
                      type="number"
                      step="0.1"
                      defaultValue={display.upper}
                      className="tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-profile`}>Hồ sơ ca</Label>
                  <Select
                    name="profile"
                    defaultValue={display.profile ?? choices.data.profiles[0]?.id}
                    open={openSelector === "profile"}
                    onOpenChange={(open) => setOpenSelector(open ? "profile" : null)}
                  >
                    <SelectTrigger id={`${id}-profile`} className="min-w-0 text-base md:text-sm">
                      <SelectValue placeholder="Chọn hồ sơ ca" />
                    </SelectTrigger>
                    <SelectContent container={portalContainer}>
                      {choices.data.profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-timezone`}>Múi giờ</Label>
                  <Input
                    id={`${id}-timezone`}
                    name="timezone"
                    readOnly
                    required
                    defaultValue={display.timezone}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-method`}>Cách ghi nhận</Label>
                  <Select
                    name="method"
                    defaultValue={display.method}
                    open={openSelector === "method"}
                    onOpenChange={(open) => setOpenSelector(open ? "method" : null)}
                  >
                    <SelectTrigger id={`${id}-method`} className="min-w-0 text-base md:text-sm">
                      <SelectValue placeholder="Chọn cách ghi nhận" />
                    </SelectTrigger>
                    <SelectContent container={portalContainer}>
                      {choices.data.methods.map((method) => (
                        <SelectItem key={method.code} value={method.code}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <EquipmentDetailTemperatureStaffFields
                  configuration={configuration}
                  id={id}
                  portalContainer={portalContainer}
                  openSelector={openSelector}
                  setOpenSelector={setOpenSelector}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-reason`}>Lý do thay đổi</Label>
                  <Input id={`${id}-reason`} name="reason" required maxLength={2000} />
                </div>
                {!choices.data.suggested_effective_from && (
                  <p role="alert">
                    Chưa có ranh giới hiệu lực hợp lệ; phiên bản tương lai hiện có cần được giải
                    quyết trước.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={mutation.isPending || !choices.data.suggested_effective_from}
                  aria-busy={mutation.isPending}
                >
                  <span hidden={!mutation.isPending}>
                    <Loader2 aria-hidden="true" className="mr-2 inline size-4 animate-spin" />
                    Đang lưu…
                  </span>
                  <span hidden={mutation.isPending}>Lưu cấu hình nhiệt độ</span>
                </Button>
              </form>
            )}
          </section>
        )}
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </ScrollArea>
  )
}
