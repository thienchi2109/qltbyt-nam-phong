-- Migration to add da_ban_giao status for external transfers
-- This allows better tracking of handover vs return for external equipment transfers

-- Add new status to the CHECK constraint
ALTER TABLE yeu_cau_luan_chuyen 
DROP CONSTRAINT IF EXISTS yeu_cau_luan_chuyen_trang_thai_check;

ALTER TABLE yeu_cau_luan_chuyen 
ADD CONSTRAINT yeu_cau_luan_chuyen_trang_thai_check 
CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh'));

-- Update the history logging function to handle the new status
CREATE OR REPLACE FUNCTION log_luan_chuyen_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF (TG_OP = 'INSERT') OR (OLD.trang_thai IS DISTINCT FROM NEW.trang_thai) THEN
        INSERT INTO lich_su_luan_chuyen (
            yeu_cau_id,
            trang_thai_cu,
            trang_thai_moi,
            hanh_dong,
            mo_ta,
            nguoi_thuc_hien_id
        ) VALUES (
            NEW.id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.trang_thai END,
            NEW.trang_thai,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN NEW.trang_thai = 'da_duyet' THEN 'approve'
                WHEN NEW.trang_thai = 'dang_luan_chuyen' THEN 'handover'
                WHEN NEW.trang_thai = 'da_ban_giao' THEN 'delivered'
                WHEN NEW.trang_thai = 'hoan_thanh' THEN 'complete'
                ELSE 'edit'
            END,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Tạo yêu cầu luân chuyển mới'
                WHEN NEW.trang_thai = 'da_duyet' THEN 'Phê duyệt yêu cầu'
                WHEN NEW.trang_thai = 'dang_luan_chuyen' THEN 'Bàn giao thiết bị'
                WHEN NEW.trang_thai = 'da_ban_giao' THEN 'Đã bàn giao thiết bị cho đơn vị bên ngoài'
                WHEN NEW.trang_thai = 'hoan_thanh' THEN 'Hoàn thành luân chuyển (đã hoàn trả)'
                ELSE 'Chỉnh sửa thông tin yêu cầu'
            END,
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment about the new status
COMMENT ON COLUMN yeu_cau_luan_chuyen.trang_thai IS 'Trạng thái: cho_duyet, da_duyet, dang_luan_chuyen, da_ban_giao (chỉ cho bên ngoài), hoan_thanh'; 