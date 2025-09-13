import { useState, useEffect } from 'react'

/**
 * Hook để debounce một giá trị trong khoảng thời gian delay
 * Giúp giảm số lần API calls khi user gõ liên tục
 * 
 * @param value - Giá trị cần debounce
 * @param delay - Thời gian delay (ms), khuyến nghị 250ms cho search
 * @returns Giá trị đã được debounce
 * 
 * @example
 * ```typescript
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearch = useDebounce(searchTerm, 250)
 * 
 * // Chỉ trigger API call khi debouncedSearch thay đổi
 * useEffect(() => {
 *   if (debouncedSearch.length >= 2) {
 *     searchEquipment(debouncedSearch)
 *   }
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set timer để update value sau delay ms
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clear timer nếu value thay đổi trước khi timer chạy
    // Điều này đảm bảo chỉ value cuối cùng được sử dụng
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook debounce chuyên dụng cho search với delay 250ms
 * Tối ưu cho trải nghiệm tìm kiếm nhanh nhưng không spam API
 * 
 * @param searchTerm - Từ khóa tìm kiếm
 * @returns Từ khóa đã được debounce với delay 250ms
 */
export function useSearchDebounce(searchTerm: string): string {
  return useDebounce(searchTerm, 250)
}
