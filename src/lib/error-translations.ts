export function translateRpcError(error: string | null | undefined): string {
  if (!error) return "Lỗi không xác định"

  const message = String(error)

  if (message.toLowerCase().includes("permission denied")) {
    return "Không có quyền thực hiện"
  }

  if (message.includes("duplicate key") || message.includes("already exists")) {
    return "Mã nhóm đã tồn tại trong đơn vị"
  }

  if (message.includes("Category not found")) {
    return "Không tìm thấy danh mục"
  }

  if (message.includes("Parent category not found")) {
    return "Không tìm thấy nhóm cha"
  }

  if (message.includes("Parent category must belong to the same tenant")) {
    return "Nhóm cha không thuộc đơn vị hiện tại"
  }

  if (message.includes("Category belongs to different tenant")) {
    return "Danh mục thuộc đơn vị khác"
  }

  if (message.includes("Category cannot be its own parent")) {
    return "Danh mục không thể là cha của chính nó"
  }

  if (message.includes("Cannot delete category") && message.includes("equipment")) {
    return "Danh mục đang được gán thiết bị. Vui lòng gỡ thiết bị trước."
  }

  if (message.includes("Cannot delete category") && message.includes("child category")) {
    return "Danh mục đang có danh mục con. Vui lòng chuyển hoặc xóa danh mục con trước."
  }

  if (message.includes("Cannot delete category") && message.includes("quota line item")) {
    return "Danh mục đang được dùng trong định mức. Vui lòng xóa khỏi định mức trước."
  }

  if (message.includes("Category code (p_ma_nhom) is required")) {
    return "Mã nhóm không được để trống"
  }

  if (message.includes("Category name (p_ten_nhom) is required")) {
    return "Tên nhóm không được để trống"
  }

  if (message.includes("Classification (p_phan_loai)")) {
    return "Phân loại không hợp lệ"
  }

  return message.length > 80 ? message.slice(0, 80) + "..." : message
}
