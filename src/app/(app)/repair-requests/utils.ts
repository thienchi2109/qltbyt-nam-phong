import { parseLocalDate } from "@/lib/date-utils"

export type DaysRemainingInfo = {
  days: number
  status: 'success' | 'warning' | 'danger'
  color: string
  text: string
}

// Calculate days remaining and a simple status signal for the due-date progress indicator.
export function calculateDaysRemaining(desiredDate: string | null): DaysRemainingInfo | null {
  if (!desiredDate) return null

  const today = new Date()
  const targetDate = parseLocalDate(desiredDate)
  if (!targetDate) return null
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  let status: DaysRemainingInfo['status']
  let color: string

  if (diffDays > 7) {
    status = 'success'
    color = 'bg-green-500'
  } else if (diffDays > 0) {
    status = 'warning'
    color = 'bg-orange-500'
  } else {
    status = 'danger'
    color = 'bg-red-500'
  }

  return {
    days: diffDays,
    status,
    color,
    text:
      diffDays > 0
        ? `Còn ${diffDays} ngày`
        : diffDays === 0
          ? 'Hôm nay'
          : `Quá hạn ${Math.abs(diffDays)} ngày`,
  }
}

export function getStatusVariant(status: string | null): 'destructive' | 'secondary' | 'default' | 'outline' {
  switch (status) {
    case 'Chờ xử lý':
      return 'destructive'
    case 'Đã duyệt':
      return 'secondary'
    case 'Hoàn thành':
      return 'default'
    case 'Không HT':
      return 'outline'
    default:
      return 'outline'
  }
}
