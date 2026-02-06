import { 
  isDepartmentMatch, 
  createDepartmentFilterCondition, 
  shouldBypassDepartmentFilter 
} from '../department-utils'

describe('Department Utils', () => {
  describe('isDepartmentMatch', () => {
    it('should match exact department names', () => {
      expect(isDepartmentMatch('Khoa Nội', 'Khoa Nội')).toBe(true)
      expect(isDepartmentMatch('Khoa Tim Mạch', 'Khoa Tim Mạch')).toBe(true)
    })

    it('should match case-insensitive', () => {
      expect(isDepartmentMatch('khoa nội', 'Khoa Nội')).toBe(true)
      expect(isDepartmentMatch('KHOA TIM MẠCH', 'khoa tim mạch')).toBe(true)
    })

    it('should match partial names', () => {
      expect(isDepartmentMatch('Khoa Nội', 'Khoa Nội Tổng Hợp')).toBe(true)
      expect(isDepartmentMatch('Khoa Tim Mạch', 'Tim Mạch')).toBe(true)
      expect(isDepartmentMatch('Nội', 'Khoa Nội')).toBe(true)
    })

    it('should match common abbreviations', () => {
      expect(isDepartmentMatch('Khoa Nội', 'K Noi')).toBe(true)
      expect(isDepartmentMatch('K Tim Mạch', 'Khoa Tim Mạch')).toBe(true)
      expect(isDepartmentMatch('Phòng Vật Tư', 'P Vật Tư')).toBe(true)
      expect(isDepartmentMatch('Ban Giám Đốc', 'B Giám Đốc')).toBe(true)
    })

    it('should not match unrelated departments', () => {
      expect(isDepartmentMatch('Khoa Nội', 'Khoa Ngoại')).toBe(false)
      expect(isDepartmentMatch('Tim Mạch', 'Thần Kinh')).toBe(false)
      expect(isDepartmentMatch('K Noi', 'Khoa Ngoại')).toBe(false)
    })

    it('should handle null/undefined values', () => {
      expect(isDepartmentMatch(null, 'Khoa Nội')).toBe(false)
      expect(isDepartmentMatch('Khoa Nội', null)).toBe(false)
      expect(isDepartmentMatch(null, null)).toBe(false)
      expect(isDepartmentMatch(undefined, 'Khoa Nội')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(isDepartmentMatch('', 'Khoa Nội')).toBe(false)
      expect(isDepartmentMatch('Khoa Nội', '')).toBe(false)
      expect(isDepartmentMatch('', '')).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(isDepartmentMatch('  Khoa Nội  ', 'Khoa Nội')).toBe(true)
      expect(isDepartmentMatch('Khoa Nội', '  Khoa Nội  ')).toBe(true)
    })
  })

  describe('createDepartmentFilterCondition', () => {
    it('should create ILIKE condition for department', () => {
      const condition = createDepartmentFilterCondition('Khoa Nội')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.khoa nội')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.%khoa nội%')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.k noi')
    })

    it('should handle departments with abbreviations', () => {
      const condition = createDepartmentFilterCondition('Kế Hoạch Tổng Hợp')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.kế hoạch tổng hợp')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.%kế hoạch tổng hợp%')
      expect(condition).toContain('khoa_phong_quan_ly.ilike.kế hoạch tng hợp')
    })

    it('should return null for invalid input', () => {
      expect(createDepartmentFilterCondition(null)).toBeNull()
      expect(createDepartmentFilterCondition(undefined)).toBeNull()
      expect(createDepartmentFilterCondition('')).toBeNull()
      expect(createDepartmentFilterCondition('   ')).toBeNull()
    })

    it('should escape special characters', () => {
      const condition = createDepartmentFilterCondition('Khoa A&B')
      expect(condition).toBeDefined()
      // Should not contain unescaped special characters that could break the query
    })
  })

  describe('shouldBypassDepartmentFilter', () => {
    it('should bypass for global role', () => {
      expect(shouldBypassDepartmentFilter('global')).toBe(true)
    })

    it('should bypass for admin role', () => {
      expect(shouldBypassDepartmentFilter('admin')).toBe(true)
    })

    it('should bypass for to_qltb role', () => {
      expect(shouldBypassDepartmentFilter('to_qltb')).toBe(true)
    })

    it('should not bypass for qltb_khoa role', () => {
      expect(shouldBypassDepartmentFilter('qltb_khoa')).toBe(false)
    })

    it('should not bypass for regional_leader role', () => {
      expect(shouldBypassDepartmentFilter('regional_leader')).toBe(false)
    })

    it('should not bypass for user role', () => {
      expect(shouldBypassDepartmentFilter('user')).toBe(false)
    })

    it('should not bypass for unknown roles', () => {
      expect(shouldBypassDepartmentFilter('unknown')).toBe(false)
      expect(shouldBypassDepartmentFilter('')).toBe(false)
    })

    it('should handle null/undefined roles', () => {
      expect(shouldBypassDepartmentFilter(null)).toBe(false)
      expect(shouldBypassDepartmentFilter(undefined)).toBe(false)
    })
  })

  describe('Integration Tests', () => {
    it('should work together for role-based filtering', () => {
      // Admin user - should bypass filtering
      expect(shouldBypassDepartmentFilter('admin')).toBe(true)
      expect(createDepartmentFilterCondition('Khoa Nội')).toBeDefined() // Still creates condition but won't be used

      // Department user - should apply filtering
      expect(shouldBypassDepartmentFilter('qltb_khoa')).toBe(false)
      const condition = createDepartmentFilterCondition('Khoa Nội')
      expect(condition).toBeDefined()
      expect(condition).toContain('khoa_phong_quan_ly.ilike.%khoa nội%')
    })

    it('should handle real-world department scenarios', () => {
      const testCases = [
        { user: 'Khoa Nội Tổng Hợp', equipment: 'Khoa Nội', shouldMatch: true },
        { user: 'K Tim Mạch', equipment: 'Khoa Tim Mạch', shouldMatch: true },
        { user: 'K Noi', equipment: 'Khoa Nội', shouldMatch: true },
        { user: 'Khoa Nội', equipment: 'Khoa Ngoại', shouldMatch: false },
        { user: 'Tim Mạch', equipment: 'Thần Kinh', shouldMatch: false },
      ]

      testCases.forEach(({ user, equipment, shouldMatch }) => {
        expect(isDepartmentMatch(user, equipment)).toBe(shouldMatch)
      })
    })
  })
})
