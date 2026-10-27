"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { useTemperatureConfiguration } from "@/hooks/use-temperature-configuration"

/** Keep every assignment in FormData, including staff outside the current search page. */
export function EquipmentDetailTemperatureStaffFields({
  configuration,
  id,
  portalContainer,
  openSelector,
  setOpenSelector,
}: {
  configuration: ReturnType<typeof useTemperatureConfiguration>
  id: string
  portalContainer: HTMLElement | null
  openSelector: string | null
  setOpenSelector: (selector: string | null) => void
}) {
  const {
    primaryChoices,
    substituteChoices,
    staffSearch,
    setStaffSearch,
    staffCursor,
    setStaffCursor,
    staff,
    selectedStaff,
    setStaffSelection,
  } = configuration
  const selectedSubstitutes = new Set(selectedStaff.substitutes)
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-staff-search`}>Tìm nhân sự</Label>
        <Input
          id={`${id}-staff-search`}
          maxLength={200}
          value={staffSearch}
          onChange={(event) => {
            setStaffSearch(event.target.value)
            setStaffCursor(null)
          }}
        />
      </div>
      {staff.error && (
        <p role="alert">
          Không tải được nhân sự.
          <Button type="button" onClick={() => void staff.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-primary`}>Phụ trách chính</Label>
        <Select
          name="primary"
          open={openSelector === "primary"}
          onOpenChange={(open) => setOpenSelector(open ? "primary" : null)}
          value={String(selectedStaff.primary)}
          onValueChange={(value) => setStaffSelection({ ...selectedStaff, primary: Number(value) })}
        >
          <SelectTrigger id={`${id}-primary`} className="min-w-0 text-base md:text-sm">
            <SelectValue placeholder="Chọn nhân sự" />
          </SelectTrigger>
          <SelectContent container={portalContainer}>
            {primaryChoices.map((person) => (
              <SelectItem key={person.id} value={String(person.id)}>
                {person.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-substitutes`}>Nhân sự thay thế</Label>
        {selectedStaff.substitutes.map((personId) => (
          <input key={personId} type="hidden" name="substitutes" value={personId} />
        ))}
        <DropdownMenu
          open={openSelector === "substitutes"}
          onOpenChange={(open) => setOpenSelector(open ? "substitutes" : null)}
        >
          <DropdownMenuTrigger asChild>
            <Button
              id={`${id}-substitutes`}
              type="button"
              variant="outline"
              className="w-full justify-between text-base md:text-sm"
            >
              {selectedStaff.substitutes.length
                ? `Đã chọn ${selectedStaff.substitutes.length} người`
                : "Chọn nhân sự thay thế"}
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            container={portalContainer}
            align="start"
            className="z-[1003] max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto"
          >
            {substituteChoices.map((person) => (
              <DropdownMenuCheckboxItem
                key={person.id}
                checked={selectedSubstitutes.has(person.id)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  setStaffSelection({
                    ...selectedStaff,
                    substitutes: checked
                      ? [...selectedStaff.substitutes, person.id]
                      : selectedStaff.substitutes.filter((personId) => personId !== person.id),
                  })
                }
              >
                {person.full_name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {staff.data?.next_cursor && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setStaffCursor(staff.data?.next_cursor ?? null)}
        >
          Nhân sự tiếp
        </Button>
      )}
      {staffCursor && (
        <Button type="button" variant="outline" onClick={() => setStaffCursor(null)}>
          Nhân sự đầu
        </Button>
      )}
    </>
  )
}
