"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { QR_ACTION_ITEMS, type QRActionKey } from "./qr-action-sheet-config"

interface QRActionSheetActionsProps {
  onAction: (action: QRActionKey) => void
}

export function QRActionSheetActions({ onAction }: QRActionSheetActionsProps) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">Hành động có thể thực hiện:</h4>

      <div className="grid gap-3">
        {QR_ACTION_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <Button
              key={item.action}
              variant={item.variant}
              className="justify-start h-auto p-4"
              onClick={() => onAction(item.action)}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.iconContainerClassName}`}>
                  <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{item.title}</div>
                  <div className={`text-sm ${item.descriptionClassName}`}>{item.description}</div>
                </div>
              </div>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
