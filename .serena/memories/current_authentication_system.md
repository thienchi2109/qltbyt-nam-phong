# Current Authentication System

## Architecture
- **Main Component**: `src/contexts/auth-context.tsx` - Custom AuthProvider
- **Login Page**: `src/app/page.tsx` - Custom login form
- **Database**: Supabase `nhan_vien` table for user storage

## Authentication Flow
1. User enters username/password
2. Calls `authenticate_user_dual_mode` RPC function
3. Fallback to direct password comparison if RPC fails
4. Creates Base64-encoded session token in localStorage
5. 3-hour session expiration with auto-logout warnings

## User Roles & Permissions
- **admin**: Full system access
- **to_qltb**: Equipment management team
- **qltb_khoa**: Department-level equipment management  
- **user**: Basic user access

## Security Features
- Dual authentication modes (hashed vs legacy plain text)
- Department-based authorization (`khoa_phong` field)
- Suspicious password blocking
- Failed login attempt tracking
- Session expiration notifications
- Admin password reset functionality

## Database Schema (nhan_vien table)
- id, username, password, hashed_password
- full_name, role, khoa_phong
- is_active, last_login, failed_attempts
- password_reset_required, created_at