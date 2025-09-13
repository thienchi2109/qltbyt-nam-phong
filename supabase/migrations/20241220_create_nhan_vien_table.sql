-- Create nhan_vien table for user management
-- This table stores user accounts with basic authentication (username/password)

CREATE TABLE IF NOT EXISTS nhan_vien (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Plain text password as requested
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'to_qltb', 'qltb_khoa', 'user')),
    khoa_phong VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments to describe the table and columns
COMMENT ON TABLE nhan_vien IS 'Bảng quản lý tài khoản nhân viên';
COMMENT ON COLUMN nhan_vien.username IS 'Tên đăng nhập (duy nhất)';
COMMENT ON COLUMN nhan_vien.password IS 'Mật khẩu (plain text)';
COMMENT ON COLUMN nhan_vien.full_name IS 'Họ và tên đầy đủ';
COMMENT ON COLUMN nhan_vien.role IS 'Vai trò: admin (Quản trị hệ thống), to_qltb (Tổ QLTB CDC), qltb_khoa (QLTB Khoa/Phòng), user (Nhân viên)';
COMMENT ON COLUMN nhan_vien.khoa_phong IS 'Khoa/Phòng làm việc';

-- Create index for faster username lookup
CREATE INDEX idx_nhan_vien_username ON nhan_vien(username);
CREATE INDEX idx_nhan_vien_role ON nhan_vien(role);

-- Insert default admin account
INSERT INTO nhan_vien (username, password, full_name, role, khoa_phong) 
VALUES ('admin', 'admin123', 'Quản trị viên hệ thống', 'admin', 'Ban Giám đốc')
ON CONFLICT (username) DO NOTHING; 