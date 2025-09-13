/**
 * Department Matching Utilities for Role-Based Access Control
 * 
 * This module provides utilities for matching user departments with equipment
 * managing departments, supporting fuzzy matching and hierarchical relationships.
 */

/**
 * Normalize department name for comparison
 * - Trims whitespace
 * - Converts to lowercase for case-insensitive comparison
 * - Handles null/undefined values
 */
export function normalizeDepartmentName(department: string | null | undefined): string {
  if (!department) return ''
  return department.trim().toLowerCase()
}

/**
 * Check if two department names match using fuzzy logic
 * Supports:
 * - Exact match (case-insensitive)
 * - Partial match (one contains the other)
 * - Common abbreviations and variations
 */
export function isDepartmentMatch(
  userDepartment: string | null | undefined,
  equipmentDepartment: string | null | undefined
): boolean {
  const userDept = normalizeDepartmentName(userDepartment)
  const equipDept = normalizeDepartmentName(equipmentDepartment)
  
  // Handle empty values
  if (!userDept || !equipDept) return false
  
  // Exact match
  if (userDept === equipDept) return true
  
  // Partial match - either department contains the other
  if (userDept.includes(equipDept) || equipDept.includes(userDept)) return true
  
  // Handle common department abbreviations and variations
  const userDeptNormalized = normalizeCommonAbbreviations(userDept)
  const equipDeptNormalized = normalizeCommonAbbreviations(equipDept)
  
  if (userDeptNormalized === equipDeptNormalized) return true
  if (userDeptNormalized.includes(equipDeptNormalized) || equipDeptNormalized.includes(userDeptNormalized)) return true
  
  return false
}

/**
 * Normalize common department abbreviations and variations
 * This helps match departments that might be written differently
 */
function normalizeCommonAbbreviations(department: string): string {
  let normalized = department
  
  // Common Vietnamese medical department abbreviations
  const abbreviations: Record<string, string> = {
    'khoa': 'k',
    'phòng': 'p',
    'ban': 'b',
    'tổ': 't',
    'nội': 'noi',
    'ngoại': 'ngoai',
    'sản': 'san',
    'nhi': 'nhi',
    'mắt': 'mat',
    'tai mũi họng': 'tmh',
    'tmh': 'tai mui hong',
    'răng hàm mặt': 'rhm',
    'rhm': 'rang ham mat',
    'chẩn đoán hình ảnh': 'cdha',
    'cdha': 'chan doan hinh anh',
    'xét nghiệm': 'xn',
    'xn': 'xet nghiem'
  }
  
  // Apply abbreviation normalization
  for (const [full, abbrev] of Object.entries(abbreviations)) {
    normalized = normalized.replace(new RegExp(full, 'gi'), abbrev)
  }
  
  // Remove common prefixes/suffixes that don't affect matching
  normalized = normalized.replace(/^(khoa|phong|ban|to)\s+/gi, '')
  normalized = normalized.replace(/\s+(khoa|phong|ban|to)$/gi, '')
  
  return normalized.trim()
}

/**
 * Create Supabase query condition for department filtering
 * Returns an OR condition string for use with Supabase queries
 */
export function createDepartmentFilterCondition(userDepartment: string | null | undefined): string | null {
  const normalizedDept = normalizeDepartmentName(userDepartment)
  if (!normalizedDept) return null
  
  // Create multiple matching patterns for comprehensive coverage
  const patterns = [
    normalizedDept, // Exact match
    `%${normalizedDept}%`, // Contains user department
  ]
  
  // Add abbreviated versions
  const abbreviated = normalizeCommonAbbreviations(normalizedDept)
  if (abbreviated !== normalizedDept) {
    patterns.push(abbreviated)
    patterns.push(`%${abbreviated}%`)
  }
  
  // Create ILIKE conditions for case-insensitive matching
  const conditions = patterns.map(pattern => `khoa_phong_quan_ly.ilike.${pattern}`)
  
  return conditions.join(',')
}

/**
 * Check if user role should bypass department filtering
 * Admin and management roles typically see all equipment
 */
export function shouldBypassDepartmentFilter(userRole: string | null | undefined): boolean {
  if (!userRole) return false
  
  const adminRoles = ['admin', 'to_qltb']
  return adminRoles.includes(userRole.toLowerCase())
}

/**
 * Get user's effective departments for equipment access
 * Some users might have access to multiple departments
 */
export function getUserEffectiveDepartments(
  userDepartment: string | null | undefined,
  userRole: string | null | undefined
): string[] {
  const departments: string[] = []
  
  if (userDepartment) {
    departments.push(userDepartment)
    
    // Add hierarchical departments based on role
    if (userRole === 'qltb_khoa') {
      // Department managers might have access to sub-departments
      const subDepartments = getSubDepartments(userDepartment)
      departments.push(...subDepartments)
    }
  }
  
  return departments
}

/**
 * Get sub-departments that a department manager might oversee
 * This is a placeholder for future hierarchical department structure
 */
function getSubDepartments(parentDepartment: string): string[] {
  // This could be expanded to support hierarchical department structures
  // For now, return empty array as most departments are flat
  return []
}

/**
 * Validate department access for a specific equipment item
 * Used for additional security checks on individual equipment access
 */
export function validateEquipmentAccess(
  userDepartment: string | null | undefined,
  userRole: string | null | undefined,
  equipmentDepartment: string | null | undefined
): boolean {
  // Admin roles have access to all equipment
  if (shouldBypassDepartmentFilter(userRole)) {
    return true
  }
  
  // Check department match
  return isDepartmentMatch(userDepartment, equipmentDepartment)
}
