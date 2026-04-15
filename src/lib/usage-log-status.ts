type UsageLogStatusLike = {
  tinh_trang_ban_dau?: string | null
  tinh_trang_ket_thuc?: string | null
  tinh_trang_thiet_bi?: string | null
}

export function getUsageLogInitialStatus(log: UsageLogStatusLike): string | null {
  return log.tinh_trang_ban_dau ?? log.tinh_trang_thiet_bi ?? null
}

export function getUsageLogFinalStatus(log: UsageLogStatusLike): string | null {
  return log.tinh_trang_ket_thuc ?? log.tinh_trang_thiet_bi ?? null
}
