import { Building2 } from 'lucide-react'

interface TransfersTenantSelectionPlaceholderProps {
  className?: string
}

/**
 * Placeholder shown to multi-tenant users (global/regional_leader)
 * before they select a specific facility to view transfers.
 * Prevents loading massive datasets from all tenants.
 */
export function TransfersTenantSelectionPlaceholder({
  className = 'min-h-[400px]',
}: TransfersTenantSelectionPlaceholderProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
          <p className="text-sm text-muted-foreground">
            Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem dữ liệu.
            Điều này giúp tránh tải dữ liệu lớn từ nhiều cơ sở cùng lúc.
          </p>
        </div>
      </div>
    </div>
  )
}
