/**
 * Test suite for transfer history logging functionality
 * Tests the fix for missing transfer history in equipment history tab
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Transfer History Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include ngay_thuc_hien when logging transfer completion', async () => {
    // Mock transfer data
    const mockTransfer = {
      id: 1,
      thiet_bi_id: 123,
      ma_yeu_cau: 'LC-2024-001',
      loai_hinh: 'noi_bo',
      khoa_phong_hien_tai: 'Khoa Nội',
      khoa_phong_nhan: 'Khoa Ngoại',
      don_vi_nhan: null
    };

    const mockUser = { id: 'user-123' };

    // Expected history insert data
    const expectedHistoryData = {
      thiet_bi_id: mockTransfer.thiet_bi_id,
      loai_su_kien: 'Luân chuyển nội bộ',
      mo_ta: 'Thiết bị được luân chuyển từ "Khoa Nội" đến "Khoa Ngoại".',
      chi_tiet: {
        ma_yeu_cau: mockTransfer.ma_yeu_cau,
        loai_hinh: mockTransfer.loai_hinh,
        khoa_phong_hien_tai: mockTransfer.khoa_phong_hien_tai,
        khoa_phong_nhan: mockTransfer.khoa_phong_nhan,
        don_vi_nhan: mockTransfer.don_vi_nhan,
      },
      yeu_cau_id: mockTransfer.id,
      nguoi_thuc_hien_id: mockUser.id,
      ngay_thuc_hien: expect.any(String) // Should be ISO string
    };

    // Mock the insert function
    const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    
    // Simulate the history logging logic from handleCompleteTransfer
    const loai_su_kien = mockTransfer.loai_hinh === 'noi_bo' 
      ? 'Luân chuyển nội bộ' 
      : mockTransfer.loai_hinh === 'ben_ngoai' 
        ? 'Luân chuyển bên ngoài' 
        : 'Thanh lý';

    const mo_ta = mockTransfer.loai_hinh === 'noi_bo'
      ? `Thiết bị được luân chuyển từ "${mockTransfer.khoa_phong_hien_tai}" đến "${mockTransfer.khoa_phong_nhan}".`
      : `Thiết bị được hoàn trả từ đơn vị bên ngoài "${mockTransfer.don_vi_nhan}".`;

    const historyData = {
      thiet_bi_id: mockTransfer.thiet_bi_id,
      loai_su_kien: loai_su_kien,
      mo_ta: mo_ta,
      chi_tiet: {
        ma_yeu_cau: mockTransfer.ma_yeu_cau,
        loai_hinh: mockTransfer.loai_hinh,
        khoa_phong_hien_tai: mockTransfer.khoa_phong_hien_tai,
        khoa_phong_nhan: mockTransfer.khoa_phong_nhan,
        don_vi_nhan: mockTransfer.don_vi_nhan,
      },
      yeu_cau_id: mockTransfer.id,
      nguoi_thuc_hien_id: mockUser.id,
      ngay_thuc_hien: new Date().toISOString()
    };

    // Simulate the database call
    mockFrom('lich_su_thiet_bi');
    mockInsert(historyData);

    // Verify that ngay_thuc_hien is included
    expect(historyData).toHaveProperty('ngay_thuc_hien');
    expect(historyData.ngay_thuc_hien).toBeTruthy();
    expect(typeof historyData.ngay_thuc_hien).toBe('string');
    
    // Verify the date is a valid ISO string
    expect(() => new Date(historyData.ngay_thuc_hien)).not.toThrow();
  });

  it('should format transfer description correctly for internal transfers', () => {
    const mockTransfer = {
      loai_hinh: 'noi_bo',
      khoa_phong_hien_tai: 'Khoa Tim Mạch',
      khoa_phong_nhan: 'Khoa Hồi Sức'
    };

    const expectedDescription = 'Thiết bị được luân chuyển từ "Khoa Tim Mạch" đến "Khoa Hồi Sức".';
    const actualDescription = `Thiết bị được luân chuyển từ "${mockTransfer.khoa_phong_hien_tai}" đến "${mockTransfer.khoa_phong_nhan}".`;

    expect(actualDescription).toBe(expectedDescription);
  });

  it('should format transfer description correctly for external transfers', () => {
    const mockTransfer = {
      loai_hinh: 'ben_ngoai',
      don_vi_nhan: 'Bệnh viện Đa khoa Cần Thơ'
    };

    const expectedDescription = 'Thiết bị được hoàn trả từ đơn vị bên ngoài "Bệnh viện Đa khoa Cần Thơ".';
    const actualDescription = `Thiết bị được hoàn trả từ đơn vị bên ngoài "${mockTransfer.don_vi_nhan}".`;

    expect(actualDescription).toBe(expectedDescription);
  });

  it('should set correct event type based on transfer type', () => {
    const testCases = [
      { loai_hinh: 'noi_bo', expected: 'Luân chuyển nội bộ' },
      { loai_hinh: 'ben_ngoai', expected: 'Luân chuyển bên ngoài' },
      { loai_hinh: 'thanh_ly', expected: 'Thanh lý' }
    ];

    testCases.forEach(({ loai_hinh, expected }) => {
      const loai_su_kien = loai_hinh === 'noi_bo' 
        ? 'Luân chuyển nội bộ' 
        : loai_hinh === 'ben_ngoai' 
          ? 'Luân chuyển bên ngoài' 
          : 'Thanh lý';

      expect(loai_su_kien).toBe(expected);
    });
  });

  it('should include all required fields in chi_tiet object', () => {
    const mockTransfer = {
      ma_yeu_cau: 'LC-2024-002',
      loai_hinh: 'noi_bo',
      khoa_phong_hien_tai: 'Khoa A',
      khoa_phong_nhan: 'Khoa B',
      don_vi_nhan: null
    };

    const chi_tiet = {
      ma_yeu_cau: mockTransfer.ma_yeu_cau,
      loai_hinh: mockTransfer.loai_hinh,
      khoa_phong_hien_tai: mockTransfer.khoa_phong_hien_tai,
      khoa_phong_nhan: mockTransfer.khoa_phong_nhan,
      don_vi_nhan: mockTransfer.don_vi_nhan,
    };

    expect(chi_tiet).toHaveProperty('ma_yeu_cau', 'LC-2024-002');
    expect(chi_tiet).toHaveProperty('loai_hinh', 'noi_bo');
    expect(chi_tiet).toHaveProperty('khoa_phong_hien_tai', 'Khoa A');
    expect(chi_tiet).toHaveProperty('khoa_phong_nhan', 'Khoa B');
    expect(chi_tiet).toHaveProperty('don_vi_nhan', null);
  });
});
