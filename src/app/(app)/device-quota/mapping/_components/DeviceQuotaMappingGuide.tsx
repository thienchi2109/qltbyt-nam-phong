"use client"

import * as React from "react"
import { Lightbulb, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "mapping-guide-dismissed"

/**
 * Dismissable 3-step guide teaching users how to map devices manually.
 * Persists dismissal via localStorage so it only appears once per user.
 *
 * Initializes as `false` on both server and client to avoid hydration mismatch,
 * then syncs with localStorage in useEffect.
 */
export function DeviceQuotaMappingGuide() {
    const [dismissed, setDismissed] = React.useState(false)

    React.useEffect(() => {
        if (localStorage.getItem(STORAGE_KEY) === "true") {
            setDismissed(true)
        }
    }, [])

    if (dismissed) return null

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, "true")
        setDismissed(true)
    }

    return (
        <div
            className="relative rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3"
            data-testid="mapping-guide"
        >
            <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-1.5 mt-0.5 shrink-0">
                    <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        Hướng dẫn phân loại thủ công
                    </p>

                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-none pl-0">
                        <li className="flex items-start gap-2">
                            <span className="font-bold shrink-0">①</span>
                            <span>Chọn thiết bị ở bảng bên trái</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold shrink-0">②</span>
                            <span>Chọn danh mục định mức ở bảng bên phải</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold shrink-0">③</span>
                            <span>Nhấn nút &quot;Phân loại&quot; ở thanh dưới cùng để xác nhận</span>
                        </li>
                    </ol>

                    <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                        Nút &quot;Gợi ý phân loại&quot; sử dụng AI và tốn nhiều tài nguyên server — chỉ dùng khi cần thiết.
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900/50"
                    onClick={handleDismiss}
                >
                    Đã hiểu
                </Button>
            </div>
        </div>
    )
}
