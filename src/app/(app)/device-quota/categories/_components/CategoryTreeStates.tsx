import * as React from "react"
import { FolderTree } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SKELETON_KEYS } from "./category-tree-utils"

export function CategoryTreeSkeleton() {
    return (
        <div className="space-y-3">
            {SKELETON_KEYS.map((token) => (
                <div key={token} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 flex-1 max-w-[200px]" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <div className="ml-7 space-y-1">
                        <Skeleton className="h-3 w-full max-w-[300px]" />
                        <Skeleton className="h-3 w-full max-w-[250px]" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function CategoryTreeEmpty({
    onCreate,
    hasSearch,
}: {
    onCreate: () => void
    hasSearch: boolean
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
                <FolderTree className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-base mb-1">
                {hasSearch ? "Không tìm thấy danh mục" : "Chưa có danh mục nào"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {hasSearch
                    ? "Không có danh mục nào phù hợp với từ khóa tìm kiếm. Vui lòng thử lại với từ khóa khác."
                    : "Hiện tại chưa có danh mục thiết bị nào được thiết lập. Vui lòng tạo danh mục trước khi phân loại thiết bị."}
            </p>
            {!hasSearch && (
                <Button variant="outline" size="sm" onClick={onCreate}>
                    Tạo danh mục
                </Button>
            )}
        </div>
    )
}
