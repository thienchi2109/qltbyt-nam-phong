// src/components/transfers/FacilityFilter.tsx
import * as React from "react"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface FacilityFilterProps {
  facilities: Array<{ id: number; name: string }>
  selectedId: number | null
  onSelect: (id: number | null) => void
  show: boolean
}

export function FacilityFilter({
  facilities,
  selectedId,
  onSelect,
  show,
}: FacilityFilterProps) {
  const [tempFacilityId, setTempFacilityId] = React.useState<number | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  if (!show) return null

  const selectedFacilityName = selectedId
    ? facilities.find((f) => f.id === selectedId)?.name || "Tất cả cơ sở"
    : "Tất cả cơ sở"

  return (
    <>
      {/* Desktop: Select dropdown */}
      <div className="hidden sm:block">
        <Select
          value={selectedId?.toString() || "all"}
          onValueChange={(value) =>
            onSelect(value === "all" ? null : Number(value))
          }
        >
          <SelectTrigger className="w-[200px]">
            <Building2 className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Tất cả cơ sở" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cơ sở</SelectItem>
            {facilities.map((facility) => (
              <SelectItem key={facility.id} value={facility.id.toString()}>
                {facility.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Bottom sheet with larger button */}
      <div className="sm:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-full justify-start font-medium"
              onClick={() => {
                setTempFacilityId(selectedId)
                setIsSheetOpen(true)
              }}
            >
              <Building2 className="mr-2 h-5 w-5" />
              <span className="truncate">{selectedFacilityName}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Chọn cơ sở</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto pb-4">
                <Button
                  variant={tempFacilityId === null ? "default" : "outline"}
                  className="h-12 w-full justify-start text-base"
                  onClick={() => setTempFacilityId(null)}
                >
                  <Building2 className="mr-3 h-5 w-5" />
                  Tất cả cơ sở
                </Button>
                {facilities.map((facility) => (
                  <Button
                    key={facility.id}
                    variant={tempFacilityId === facility.id ? "default" : "outline"}
                    className="h-12 w-full justify-start text-base"
                    onClick={() => setTempFacilityId(facility.id)}
                  >
                    <Building2 className="mr-3 h-5 w-5" />
                    {facility.name}
                  </Button>
                ))}
              </div>
              <SheetFooter className="flex flex-row gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="h-12 flex-1 text-base font-medium"
                  onClick={() => {
                    setTempFacilityId(selectedId)
                    setIsSheetOpen(false)
                  }}
                >
                  Hủy
                </Button>
                <Button
                  className="h-12 flex-1 text-base font-medium"
                  onClick={() => {
                    onSelect(tempFacilityId)
                    setIsSheetOpen(false)
                  }}
                >
                  Áp dụng
                </Button>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
