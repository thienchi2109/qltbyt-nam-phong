import type { CategoryListItem } from "../../categories/_types/categories"

/** Category fields consumed by the retained manual-mapping preview dialog. */
export type Category = Pick<
  CategoryListItem,
  "id" | "parent_id" | "ma_nhom" | "ten_nhom" | "phan_loai" | "level" | "so_luong_hien_co"
>
