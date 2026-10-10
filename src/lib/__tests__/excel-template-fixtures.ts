// Valid status values - must match excel-utils.ts
export const EXPECTED_STATUS_OPTIONS = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
] as const

export async function blobToBuffer(blob: Blob): Promise<Buffer> {
  // Try arrayBuffer first (modern browsers and newer Node.js)
  if (typeof blob.arrayBuffer === "function") {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Fallback for environments without arrayBuffer
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      resolve(Buffer.from(arrayBuffer))
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}
