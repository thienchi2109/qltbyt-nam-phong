export const category = {
  id: 2,
  parent_id: 1,
  ma_nhom: "G1.1",
  ten_nhom: "Máy X quang",
  phan_loai: "A",
  don_vi_tinh: "Cái",
  thu_tu_hien_thi: 2,
  level: 2,
  so_luong_hien_co: 0,
  so_luong_toi_da: 4,
  so_luong_toi_thieu: null,
  mo_ta: null,
}

export const categories = [
  {
    ...category,
    id: 1,
    parent_id: null,
    ma_nhom: "G1",
    ten_nhom: "Nhóm chẩn đoán hình ảnh",
    don_vi_tinh: null,
    thu_tu_hien_thi: 1,
    level: 1,
    so_luong_toi_da: 10,
  },
  category,
]

export const unassignedEquipment = [
  {
    id: 101,
    ma_thiet_bi: "TB-001",
    ten_thiet_bi: "Máy X quang chưa phân loại",
    model: "OEC 9900",
    serial: "SN12345",
    hang_san_xuat: "GE Healthcare",
    khoa_phong_quan_ly: "Khoa CĐHA",
    tinh_trang: "Hoạt động",
    total_count: 1,
  },
]

export const secondUnassignedEquipment = {
  ...unassignedEquipment[0],
  id: 102,
  ma_thiet_bi: "TB-002",
  ten_thiet_bi: "Máy X quang chưa phân loại thứ hai",
  serial: "SN67890",
  total_count: 2,
}

export const assignedEquipment = [
  {
    id: 101,
    ma_thiet_bi: "TB-001",
    ten_thiet_bi: "Máy X quang chưa phân loại",
    model: "OEC 9900",
    serial: "SN12345",
    hang_san_xuat: "GE Healthcare",
    khoa_phong_quan_ly: "Khoa CĐHA",
    tinh_trang: "Hoạt động",
  },
]

export const secondAssignedEquipment = {
  ...assignedEquipment[0],
  id: 102,
  ma_thiet_bi: "TB-002",
  ten_thiet_bi: "Máy X quang chưa phân loại thứ hai",
  serial: "SN67890",
}
