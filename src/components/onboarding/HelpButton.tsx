"use client"

import * as React from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { CircleHelp, Sparkles, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTour } from "@/hooks/use-tour"
import { TOUR_CONFIGS, TOUR_IDS, type TourId } from "./tour-configs"

interface HelpButtonProps {
  className?: string
}

/**
 * Help button that provides access to onboarding tours and help resources.
 * Shows in the header and allows users to start or restart tours.
 */
export function HelpButton({ className }: HelpButtonProps) {
  const { isTourCompleted, completeTour, resetTour } = useTour()
  const dashboardCompleted = isTourCompleted(TOUR_IDS.DASHBOARD_WELCOME)

  const startTour = React.useCallback(
    (tourId: TourId) => {
      const steps = TOUR_CONFIGS[tourId]
      if (!steps || steps.length === 0) return

      const driverObj = driver({
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Tiếp theo",
        prevBtnText: "Quay lại",
        doneBtnText: "Hoàn thành",
        progressText: "{{current}} / {{total}}",
        popoverClass: "onboarding-popover",
        steps,
        onDestroyStarted: () => {
          completeTour(tourId)
          driverObj.destroy()
        },
      })

      driverObj.drive()
    },
    [completeTour]
  )

  const handleStartDashboardTour = () => {
    startTour(TOUR_IDS.DASHBOARD_WELCOME)
  }

  const handleResetAndStartTour = () => {
    resetTour(TOUR_IDS.DASHBOARD_WELCOME)
    setTimeout(() => {
      startTour(TOUR_IDS.DASHBOARD_WELCOME)
    }, 100)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative rounded-full transition-all duration-200",
            "hover:bg-primary/10 hover:text-primary",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            !dashboardCompleted && "animate-pulse",
            className
          )}
          aria-label="Trợ giúp và hướng dẫn"
        >
          <CircleHelp className={cn(
            "h-5 w-5 transition-colors",
            !dashboardCompleted && "text-primary"
          )} />
          {!dashboardCompleted && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Trợ giúp & Hướng dẫn
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {dashboardCompleted ? (
          <DropdownMenuItem
            onClick={handleResetAndStartTour}
            className="flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span>Xem lại hướng dẫn</span>
              <span className="text-xs text-muted-foreground">Khám phá lại tính năng Dashboard</span>
            </div>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={handleStartDashboardTour}
            className="flex items-center gap-2 cursor-pointer bg-primary/5 hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium text-primary">Bắt đầu tour hướng dẫn</span>
              <span className="text-xs text-muted-foreground">Khám phá các tính năng chính</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
