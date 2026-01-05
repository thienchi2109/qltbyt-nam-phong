"use client"

import * as React from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { CircleHelp, Sparkles, RotateCcw, PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  const sidebarCompleted = isTourCompleted(TOUR_IDS.SIDEBAR_NAVIGATION)
  const hasUncompletedTours = !dashboardCompleted || !sidebarCompleted

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

  const handleStartSidebarTour = () => {
    startTour(TOUR_IDS.SIDEBAR_NAVIGATION)
  }

  const handleResetSidebarTour = () => {
    resetTour(TOUR_IDS.SIDEBAR_NAVIGATION)
    setTimeout(() => {
      startTour(TOUR_IDS.SIDEBAR_NAVIGATION)
    }, 100)
  }

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative rounded-full transition-all duration-200",
                  "hover:bg-primary/10 hover:text-primary",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  hasUncompletedTours && "animate-pulse",
                  className
                )}
                aria-label="Trợ giúp và hướng dẫn"
              >
                <CircleHelp className={cn(
                  "h-5 w-5 transition-colors",
                  hasUncompletedTours && "text-primary"
                )} />
                {hasUncompletedTours && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Nhấn vào để xem hướng dẫn sử dụng cơ bản</p>
          </TooltipContent>
        </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Trợ giúp & Hướng dẫn
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {dashboardCompleted ? (
          <DropdownMenuItem
            onClick={handleResetAndStartTour}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span>Xem lại hướng dẫn Dashboard</span>
              <span className="text-xs text-muted-foreground group-hover:text-accent-foreground">Khám phá lại tính năng Dashboard</span>
            </div>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={handleStartDashboardTour}
            className="flex items-center gap-2 cursor-pointer bg-primary/5 hover:bg-primary hover:text-primary-foreground group"
          >
            <Sparkles className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
            <div className="flex flex-col">
              <span className="font-medium text-primary group-hover:text-primary-foreground">Bắt đầu tour Dashboard</span>
              <span className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">Khám phá các tính năng chính</span>
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {sidebarCompleted ? (
          <DropdownMenuItem
            onClick={handleResetSidebarTour}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span>Xem lại thanh điều hướng</span>
              <span className="text-xs text-muted-foreground group-hover:text-accent-foreground">Hướng dẫn sử dụng sidebar</span>
            </div>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={handleStartSidebarTour}
            className="flex items-center gap-2 cursor-pointer bg-primary/5 hover:bg-primary hover:text-primary-foreground group"
          >
            <PanelLeft className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
            <div className="flex flex-col">
              <span className="font-medium text-primary group-hover:text-primary-foreground">Hướng dẫn thanh điều hướng</span>
              <span className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">Khám phá menu bên trái</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
