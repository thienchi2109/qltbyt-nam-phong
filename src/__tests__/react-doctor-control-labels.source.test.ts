import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

describe('React Doctor control label source guards', () => {
  it('keeps printable handover table fields accessible by name', () => {
    const source = readSource('src/app/(app)/forms/handover/page.tsx')

    expect(source).toMatch(/aria-label="Mã thiết bị bàn giao"/)
    expect(source).toMatch(/aria-label="Tên thiết bị bàn giao"/)
    expect(source).toMatch(/aria-label="Model thiết bị bàn giao"/)
    expect(source).toMatch(/aria-label="Số serial thiết bị bàn giao"/)
    expect(source).toMatch(/aria-label="Tài liệu, phụ kiện kèm theo"/)
    expect(source).toMatch(/aria-label="Tình trạng thiết bị bàn giao"/)
    expect(source).toMatch(/aria-label="Ghi chú bàn giao"/)
  })

  it('keeps printable maintenance plan controls accessible by name', () => {
    const source = readSource('src/app/(app)/forms/maintenance/page.tsx')

    expect(source).toMatch(/aria-label="Khoa phòng lập kế hoạch"/)
    expect(source).toMatch(/aria-label="Năm kế hoạch bảo trì"/)
    expect(source).toMatch(/aria-label="Số thứ tự dòng kế hoạch mẫu"/)
    expect(source).toMatch(/aria-label="Mã thiết bị dòng kế hoạch mẫu"/)
    expect(source).toMatch(/aria-label="Tên thiết bị dòng kế hoạch mẫu"/)
    expect(source).toMatch(/aria-label="Khoa phòng sử dụng dòng kế hoạch mẫu"/)
    expect(source).toMatch(/aria-label="Thực hiện nội bộ cho dòng kế hoạch mẫu"/)
    expect(source).toMatch(/aria-label="Thuê ngoài cho dòng kế hoạch mẫu"/)

    for (const month of Array.from({ length: 12 }, (_, index) => index + 1)) {
      expect(source).toContain(`aria-label="Tháng ${month} cho dòng kế hoạch mẫu"`)
    }

    expect(source).toMatch(/aria-label="Điểm hiệu chuẩn kiểm định cho dòng kế hoạch mẫu"/)
  })

  it('keeps maintenance rejection and QR help controls accessible by name', () => {
    const maintenanceDialogs = readSource(
      'src/app/(app)/maintenance/_components/maintenance-dialogs.tsx',
    )
    const qrScanner = readSource('src/components/qr-scanner-camera.tsx')

    expect(maintenanceDialogs).toMatch(/aria-label="Lý do không duyệt kế hoạch"/)
    expect(qrScanner).toMatch(/aria-label="Mở hướng dẫn quét mã QR"/)
    expect(qrScanner).toMatch(/aria-label="Khung camera quét mã QR"/)
  })

  it('keeps usage status datalist options accessible by label', () => {
    const startUsage = readSource('src/components/start-usage-dialog.tsx')
    const endUsage = readSource('src/components/end-usage-dialog.tsx')

    expect(startUsage).toMatch(/<option key=\{status\} value=\{status\}>\s*\{status\}\s*<\/option>/)
    expect(endUsage).toMatch(/<option key=\{status\} value=\{status\}>\s*\{status\}\s*<\/option>/)
  })

  it('keeps printable equipment log fields accessible by name', () => {
    const source = readSource('src/components/log-template.tsx')

    expect(source).toMatch(/aria-label="Khoa phòng quản lý nhật ký"/)
    expect(source).toMatch(/aria-label="Người quản lý thiết bị"/)
    expect(source).toMatch(/aria-label="Tên thiết bị"/)
    expect(source).toMatch(/aria-label="Mã thiết bị"/)
    expect(source).toMatch(/aria-label="Model thiết bị"/)
    expect(source).toMatch(/aria-label="Số serial thiết bị"/)
  })
})
