"use client"

import * as React from "react"
import { ListTree } from "lucide-react"

import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { Button } from "@/components/ui/button"

import { TechnicalConfigurationEvaluationNavigatorPane } from "./TechnicalConfigurationEvaluationNavigatorPane"

type NavigatorPaneProps = React.ComponentProps<typeof TechnicalConfigurationEvaluationNavigatorPane>

export type TechnicalConfigurationEvaluationNavigatorDrawerNavigation = Readonly<{
  returnFocusTarget: HTMLElement | null
  closeDrawer: () => void
}>

type TechnicalConfigurationEvaluationNavigatorDrawerProps = {
  disabled: boolean
  navigatorProps: Omit<NavigatorPaneProps, "listOnly" | "onSelectCriterion">
  onSelectCriterion: (
    criterionId: string,
    navigation: TechnicalConfigurationEvaluationNavigatorDrawerNavigation
  ) => void
}

/** Keeps hierarchy navigation available without duplicating the always-visible matrix list. */
export function TechnicalConfigurationEvaluationNavigatorDrawer({
  disabled,
  navigatorProps,
  onSelectCriterion,
}: Readonly<TechnicalConfigurationEvaluationNavigatorDrawerProps>) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const suppressNextCloseAutoFocusRef = React.useRef(false)

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ListTree aria-hidden="true" />
        Mục lục tiêu chí
      </Button>
      <SideSheetShell
        open={open}
        onOpenChange={setOpen}
        title="Mục lục tiêu chí"
        description={
          <span className="sr-only">Điều hướng nhanh đến một tiêu chí trên trang hiện tại.</span>
        }
        side="left"
        contentClassName="w-[min(92vw,32rem)] max-w-none sm:max-w-lg"
        headerClassName="px-5 py-4 text-left"
        bodyClassName="overflow-y-auto px-5 py-4"
        closeLabel="Đóng mục lục tiêu chí"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (suppressNextCloseAutoFocusRef.current) {
            suppressNextCloseAutoFocusRef.current = false
            return
          }
          triggerRef.current?.focus()
        }}
      >
        <TechnicalConfigurationEvaluationNavigatorPane
          {...navigatorProps}
          listOnly
          onSelectCriterion={(criterionId) => {
            onSelectCriterion(criterionId, {
              returnFocusTarget: triggerRef.current,
              closeDrawer: () => {
                suppressNextCloseAutoFocusRef.current = true
                setOpen(false)
              },
            })
          }}
        />
      </SideSheetShell>
    </>
  )
}
