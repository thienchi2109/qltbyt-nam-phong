# 🔐 Authentication System Documentation

## Overview

This project uses **NextAuth v4** for authentication, providing a secure, industry-standard solution for user management and session handling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NextAuth v4                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Login Page      │────│ CredentialsProvider              │ │
│  │ (signIn)        │    │ └─ authenticate_user_dual_mode   │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                      │                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ JWT Token       │────│ Session Callbacks                │ │
│  │ (3hr expiry)    │    │ └─ Role, dept, tenant claims     │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                      │                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Middleware      │────│ Route Protection                 │ │
│  │ (withAuth)      │    │ └─ /(app)/* routes secured       │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                Supabase Backend                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ authenticate_user_dual_mode RPC                         │ │
│  │ └─ Hashed password support + Legacy fallback           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. NextAuth Configuration (`src/auth/config.ts`)

```typescript
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 3 * 60 * 60 }, // 3 hours
  providers: [
    Credentials({
      async authorize(credentials) {
        // Calls authenticate_user_dual_mode RPC
        // Returns user object with role, department, etc.
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Stores user claims in JWT
      // Handles password change detection
    },
    async session({ session, token }) {
      // Exposes user data to client
    }
  }
}
```

### 2. API Route Handler (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/auth/config"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### 3. Session Provider (`src/providers/session-provider.tsx`)

```typescript
export function NextAuthSessionProvider({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>
}
```

### 4. Middleware (`src/middleware.ts`)

```typescript
export default withAuth(
  function middleware(req) {
    // Route protection logic
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/" }
  }
)
```

## Environment Variables

Required environment variables for authentication:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# NextAuth Configuration
AUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_SECRET=your_nextauth_secret_key

# Optional Feature Flags
AUTH_MIDDLEWARE_ENABLED=true
NEXT_PUBLIC_AUTH_LEGACY_BRIDGE=false
```

## Authentication Flow

### 1. User Login
1. User enters credentials on login page (`src/app/page.tsx`)
2. Form submits to NextAuth using `signIn("credentials", {...})`
3. NextAuth calls the authorize function in CredentialsProvider
4. Authorize function calls Supabase RPC `authenticate_user_dual_mode`
5. On success, JWT token is created with user claims
6. User is redirected to dashboard

### 2. Session Management
1. JWT token contains user data: `id`, `username`, `role`, `khoa_phong`, `don_vi`
2. Token is automatically included in requests
3. Session data is available via `useSession()` hook
4. Token expires after 3 hours, requiring re-login

### 3. Route Protection
1. Middleware intercepts requests to protected routes (`/(app)/*`)
2. Checks for valid JWT token
3. Redirects unauthenticated users to login page
4. Allows authenticated users to proceed

## Database Integration

### RPC Function: `authenticate_user_dual_mode`

```sql
CREATE OR REPLACE FUNCTION authenticate_user_dual_mode(
  p_username TEXT,
  p_password TEXT
) RETURNS TABLE (
  user_id BIGINT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  khoa_phong TEXT,
  is_authenticated BOOLEAN,
  authentication_mode TEXT
) AS $$
BEGIN
  -- Implementation handles both hashed and legacy passwords
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### User Roles

- `global` - Full system access across all tenants
- `admin` - Administrative access (legacy compatibility)  
- `to_qltb` - Equipment management team
- `technician` - Technical staff with department restrictions
- `user` - Basic user access

## Multi-Tenant Support

### JWT Claims
```typescript
interface JWTToken {
  id: string
  username: string
  role: string
  khoa_phong: string
  don_vi: string | null
  full_name: string
  loginTime: number
}
```

### Session Object
```typescript
interface SessionUser {
  id: string
  username: string
  role: string
  khoa_phong: string
  don_vi: string | null
  full_name: string
}
```

## Usage in Components

### Using Session Data
```typescript
import { useSession } from "next-auth/react"

function MyComponent() {
  const { data: session, status } = useSession()
  const user = session?.user as any
  
  if (status === "loading") return <Loading />
  if (status === "unauthenticated") return <Login />
  
  return (
    <div>
      <h1>Welcome, {user.full_name}</h1>
      <p>Role: {user.role}</p>
      <p>Department: {user.khoa_phong}</p>
    </div>
  )
}
```

### Authentication Actions
```typescript
import { signIn, signOut } from "next-auth/react"

// Login
const handleLogin = async () => {
  const result = await signIn("credentials", {
    username: "admin",
    password: "password",
    redirect: false
  })
}

// Logout
const handleLogout = () => {
  signOut({ callbackUrl: "/" })
}
```

## Security Features

### Password Security
- Dual authentication mode (hashed + legacy)
- Bcrypt hashing for new passwords
- Suspicious password blocking
- Failed attempt tracking

### Session Security
- JWT tokens with 3-hour expiry
- Automatic token refresh
- Password change detection with forced re-login
- CSRF protection built-in

### Route Protection
- Middleware-based protection
- Feature flag support for gradual rollout
- Customizable redirect behavior
- Role-based access control

## Testing Authentication

### Development Testing
```bash
# Start development server
npm run dev

# Test login at http://localhost:3000
# Use existing database credentials
```

### Production Testing
```bash
# Build and test
npm run build
npm start

# Verify authentication flow
# Test different user roles
# Confirm session persistence
```

## Troubleshooting

### Common Issues

1. **"AUTH_SECRET is not set"**
   - Ensure `AUTH_SECRET` or `NEXTAUTH_SECRET` is in environment variables

2. **"Session callback error"** 
   - Check Supabase connection and RPC function exists
   - Verify environment variables are correct

3. **"Middleware not protecting routes"**
   - Check `AUTH_MIDDLEWARE_ENABLED` is true (default)
   - Verify middleware matcher configuration

4. **"Login succeeds but redirects to login"**
   - Check JWT secret matches between NextAuth and Supabase
   - Verify session callback is working

### Debug Mode
Enable debug logging in development:

```env
NEXTAUTH_DEBUG=true
```

## Migration History

- ✅ **Phase 1**: NextAuth setup and configuration
- ✅ **Phase 2**: Core authentication implementation  
- ✅ **Phase 3**: Component migration to useSession
- ✅ **Phase 4**: Legacy AuthProvider removal
- ✅ **Final**: Documentation and cleanup

## Important Notes

- **NO CUSTOM AUTH**: This project uses NextAuth v4 exclusively
- **JWT Strategy**: Stateless authentication with JWT tokens
- **Multi-tenant**: Built-in support via JWT claims
- **Production Ready**: Fully tested and deployed
- **Backward Compatible**: Works with existing user database

For any authentication-related development, always use NextAuth patterns and avoid custom authentication implementations.