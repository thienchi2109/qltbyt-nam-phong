# ⚠️ OUTDATED - Legacy Authentication System (REPLACED)

## 🚫 THIS MEMORY IS OBSOLETE - DO NOT USE

**The custom authentication system described below has been FULLY REPLACED with NextAuth v4 as of September 17, 2025.**

### ❌ What Was Replaced
- Custom `AuthProvider` in `src/contexts/auth-context.tsx` - **REMOVED**
- localStorage session management - **REPLACED with JWT**
- Manual session expiration handling - **REPLACED with NextAuth**
- Custom login form with direct RPC calls - **REPLACED with NextAuth signIn()**
- Base64 token encoding - **REPLACED with JWT tokens**

### ✅ Current System
**Use NextAuth v4 exclusively:**
- Authentication: `useSession()` from `next-auth/react`
- Login: `signIn()` from `next-auth/react`
- Logout: `signOut()` from `next-auth/react`
- Session: Automatic JWT management
- Protection: NextAuth middleware

### 📚 Current Documentation
- Read memory: `nextauth_migration_completed_2025-09-17`
- Read memory: `project_overview_updated_2025-09-17`
- See file: `AUTHENTICATION.md`
- See file: `README.md`

### 🔄 Migration Status
**100% COMPLETE** - No further migration work needed.

---

## Historical Context (For Reference Only)

The legacy system that was replaced included:

- **Main Component**: `src/contexts/auth-context.tsx` - Custom AuthProvider
- **Login Page**: Custom login form with manual authentication
- **Database**: Direct calls to `authenticate_user_dual_mode` RPC
- **Session**: localStorage with Base64 encoding
- **Security**: 3-hour session expiration with manual warnings
- **Roles**: admin, to_qltb, qltb_khoa, user
- **Features**: Department authorization, failed attempt tracking

This system worked but was replaced with NextAuth for:
- Industry-standard security
- Better session management
- CSRF protection
- Simplified codebase
- Maintainability

**DO NOT attempt to use or restore this legacy system. Use NextAuth v4 only.**