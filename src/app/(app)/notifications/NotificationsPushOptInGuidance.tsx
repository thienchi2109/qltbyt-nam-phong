import { Bell, ChevronDown, Smartphone } from "lucide-react"

/** Shows the notification content users may see on a lock screen. */
export function LockScreenPreview() {
  return (
    <div
      className="rounded-2xl bg-slate-950 p-4 text-white shadow-inner"
      aria-label="Xem trước thông báo trên màn hình khóa"
    >
      <p className="text-xs font-medium text-slate-300">
        Nội dung có thể xuất hiện trên màn hình khóa
      </p>
      <div className="mt-3 rounded-xl bg-white/10 p-3 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Bell className="size-6" aria-hidden="true" /> QLTBYT · vừa xong
        </div>
        <p className="mt-2 text-sm font-semibold">Thiết bị cần xử lý</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">
          Máy ly tâm Eppendorf tại Khoa Huyết học cần kiểm tra.
        </p>
        <p className="mt-2 text-[11px] leading-4 text-slate-400">
          Hệ điều hành có thể rút gọn nội dung trên màn hình khóa.
        </p>
      </div>
    </div>
  )
}

/** Explains the iOS and iPadOS Home Screen installation path. */
export function HomeScreenGuide() {
  return (
    <details className="group rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-amber-200 p-2">
            <Smartphone className="size-5" aria-hidden="true" />
          </span>
          Dùng iPhone hoặc iPad?
        </span>
        <ChevronDown
          className="size-5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-4 space-y-3 border-t border-amber-200 pt-4 text-sm leading-6 text-amber-950/80">
        <p>
          Web Push trên iOS/iPadOS cần phiên bản <strong>16.4 trở lên</strong> và ứng dụng được mở
          từ biểu tượng đã thêm vào Màn hình chính.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Mở ứng dụng trong Safari, chọn Chia sẻ, rồi chọn{" "}
            <strong>Thêm vào Màn hình chính</strong>.
          </li>
          <li>Mở ứng dụng từ biểu tượng vừa cài đặt, sau đó bấm Bật thông báo.</li>
        </ol>
        <p>
          Đã cài ứng dụng vào Màn hình chính không tự cấp quyền thông báo. Trình duyệt vẫn cần bạn
          bấm nút và cho phép thông báo.
        </p>
      </div>
    </details>
  )
}
