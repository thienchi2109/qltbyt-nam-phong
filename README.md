# 🏥 Hệ thống quản lý thiết bị y tế

**Vietnamese Medical Equipment Management System**

A comprehensive web application for managing medical equipment, built with modern technologies and designed for healthcare institutions in Vietnam.

## 🚀 Technology Stack

- **Frontend**: Next.js 15.3.3, React 18.3.1, TypeScript
- **Backend**: Supabase (PostgreSQL) with custom RPC gateway
- **Authentication**: NextAuth v4 with JWT strategy
- **UI Framework**: Radix UI + TailwindCSS
- **State Management**: TanStack Query (React Query) v5.81.5
- **Deployment**: Supports Vercel and Cloudflare Pages

## 📋 Core Features

### Equipment Management
- Complete equipment lifecycle tracking
- QR code generation and scanning
- Real-time status monitoring
- File attachment support
- Equipment history and audit trails

### Maintenance & Repairs
- Scheduled maintenance planning
- Repair request workflow
- Approval processes
- Service provider management
- Completion tracking

### Multi-Tenant Architecture
- Department-based data isolation
- Role-based access control
- Tenant switching capabilities
- Secure data segregation

### User Management
- Role-based permissions
- Password management
- Admin controls
- Activity logging

## 🔐 Authentication System

**This project uses NextAuth v4 for authentication** (NOT custom auth context).

### Key Components
- **Provider**: NextAuth v4 with CredentialsProvider
- **Session**: JWT strategy (3-hour expiry)
- **Database**: Supabase RPC `authenticate_user_dual_mode`
- **Protection**: Middleware-based route protection
- **Multi-tenant**: JWT claims for role, department, tenant

### User Roles
- `global` - Full system access across all tenants
- `admin` - Administrative access (legacy compatibility)
- `to_qltb` - Equipment management team
- `technician` - Technical staff with department restrictions
- `user` - Basic user access

## 🛠️ Development Setup

### Equipment Page Behavior (Global/Admin)
- To reduce initial DB load and avoid confusion, the equipment list does not fetch until you select a tenant filter.
- A tip appears: "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị".
- Your last tenant selection is remembered via localStorage (key: `equipment_tenant_filter`).
  - Use "— Chọn đơn vị —" to reset, or clear the localStorage key manually.
- Fetching is powered by TanStack Query with `enabled` gating and scoped caching.

### Prerequisites
- Node.js 18+ 
- npm (preferred package manager)
- Supabase project

### Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# NextAuth Configuration
AUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_SECRET=your_nextauth_secret_key
AUTH_MIDDLEWARE_ENABLED=true

# Optional Feature Flags
NEXT_PUBLIC_AUTH_LEGACY_BRIDGE=false
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd qltbyt-nam-phong

# Install dependencies
npm install

# Apply database migrations
# (Run SQL files in supabase/migrations/ in your Supabase SQL editor)

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run dev-https    # Start dev server with HTTPS

# Building
npm run build        # Standard Next.js build
npm run build:vercel # Build for Vercel
npm run build:cloudflare # Build for Cloudflare Pages

# Production
npm start            # Start production server
npm run start:cloudflare # Start on Cloudflare

# Deployment
npm run deploy:cloudflare # Deploy to Cloudflare Pages
npm run deploy:dual       # Deploy to both platforms

# Development Tools
npm run lint         # ESLint
npm run typecheck    # TypeScript checking
```

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── (app)/          # Protected app routes
│   │   ├── dashboard/  # Dashboard page
│   │   ├── equipment/  # Equipment management
│   │   ├── maintenance/ # Maintenance planning
│   │   ├── repair-requests/ # Repair workflows
│   │   ├── transfers/  # Equipment transfers
│   │   ├── users/      # User management
│   │   └── layout.tsx  # App layout with navigation
│   ├── api/            # API routes
│   │   ├── auth/       # NextAuth endpoints
│   │   └── rpc/        # Supabase RPC gateway
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Login page
├── auth/               # NextAuth configuration
│   └── config.ts       # NextAuth options
├── components/         # Reusable UI components
├── contexts/           # React contexts
├── hooks/             # Custom React hooks
├── lib/               # Utility libraries
├── providers/         # Provider components
├── types/             # TypeScript type definitions
└── middleware.ts      # Next.js middleware

supabase/
├── migrations/        # Database migrations
└── functions/         # Edge functions (if any)

public/
├── manifest.json      # PWA manifest
└── sw.js             # Service worker
```

## 🗄️ Database Architecture

### Multi-Tenant Design
- **Strategy**: No-RLS, RPC-only architecture
- **Data Isolation**: Tenant-scoped SQL RPCs
- **Security**: JWT-based access control
- **Performance**: Optimized for Vietnamese healthcare workflows

### Key Tables
- `nhan_vien` - User accounts and roles
- `don_vi` - Organizational units (tenants)
- `thiet_bi` - Equipment records
- `yeu_cau_sua_chua` - Repair requests
- `ke_hoach_bao_tri` - Maintenance plans
- `yeu_cau_luan_chuyen` - Transfer requests

## 🌐 Deployment

### Vercel (Recommended)
1. Connect repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Cloudflare Pages
1. Build with `npm run build:cloudflare`
2. Deploy with `npm run deploy:cloudflare`
3. Configure environment variables in Cloudflare dashboard

## 📱 PWA Support

The application includes Progressive Web App features:
- Offline functionality
- Install prompts
- Service worker for caching
- Mobile-optimized interface

## 🔒 Security Features

- JWT-based authentication with automatic expiry
- CSRF protection via NextAuth
- SQL injection prevention through RPCs
- Rate limiting on authentication endpoints
- Audit logging for administrative actions
- Secure password hashing (bcrypt)

## 🌍 Internationalization

- Primary language: Vietnamese
- Fallback: English
- Medical terminology localization
- Date/time formatting for Vietnam timezone

## 📚 Key Documentation Files

- `DEPLOYMENT.md` - Deployment instructions
- `HUONG_DAN_SU_DUNG.md` - User manual (Vietnamese)
- `CI-CD.md` - CI/CD pipeline setup
- `supabase/migrations/` - Database schema changes

## 🤝 Contributing

When working with this project:

1. **Authentication**: Always use `useSession()` from `next-auth/react`
2. **Database**: Use RPC functions through the gateway, not direct table access
3. **Multi-tenant**: Ensure tenant scoping in all data operations
4. **TypeScript**: Maintain strict typing throughout
5. **Testing**: Test with different user roles and departments

## ⚠️ Important Notes

- **Authentication System**: Uses NextAuth v4 (NOT custom auth context)
- **Package Manager**: Use npm (not pnpm or yarn)
- **Database Access**: Through RPC gateway only
- **Multi-tenant**: JWT claims handle tenant isolation
- **Vietnamese UI**: Maintain Vietnamese language support

## 📞 Support

For technical support or questions about the medical equipment management system, consult the project documentation or memory bank for detailed implementation notes.

---

**Built with ❤️ for Vietnamese healthcare institutions**
