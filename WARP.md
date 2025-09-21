# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **Vietnamese Medical Equipment Management System** ("Hệ thống quản lý thiết bị y tế") built with Next.js 15, designed for hospitals to track medical equipment, maintenance schedules, repairs, and transfers between departments.

## Architecture

### Tech Stack
- **Framework**: Next.js 15.3.3 with App Router
- **Language**: TypeScript with strict mode
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js with custom credentials provider
- **UI**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **State Management**: TanStack React Query for server state
- **PWA**: next-pwa for Progressive Web App functionality

### Project Structure
```
src/
├── app/                    # App Router pages
│   ├── (app)/             # Protected app routes with layout
│   │   ├── dashboard/     # Main dashboard
│   │   ├── equipment/     # Equipment management
│   │   ├── maintenance/   # Maintenance scheduling
│   │   ├── repair-requests/ # Repair request system
│   │   ├── transfers/     # Equipment transfer system
│   │   └── users/         # User management (admin only)
│   └── layout.tsx         # Root layout
├── auth/                  # Authentication configuration
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── [feature-components] # Feature-specific components
├── contexts/              # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── providers/            # App providers
├── types/                # TypeScript type definitions
└── middleware.ts         # NextAuth middleware for route protection
```

### Database Architecture
- **Equipment** (`thiet_bi`): Core equipment records with Vietnamese field names
- **Users** (`nhan_vien`): User accounts with role-based permissions  
- **Usage Logs**: Equipment usage tracking
- **Transfer Requests**: Equipment movement between departments
- **Maintenance Tasks**: Scheduled maintenance with monthly tracking
- **Repair Requests**: Equipment repair workflow

### Key Features
1. **Equipment Management**: Add, edit, search, filter, and import equipment from Excel
2. **QR Code System**: Generate and scan QR codes for equipment identification
3. **Maintenance Planning**: Create annual maintenance plans with monthly task tracking
4. **Transfer System**: Internal/external equipment transfers with approval workflow
5. **Repair Requests**: Submit and track equipment repair requests
6. **Role-based Access**: 4 user roles with different permissions
7. **PWA Support**: Installable as mobile app
8. **Dual Deployment**: Configured for both Vercel and Cloudflare Workers

## Development Commands

### Start Development
```bash
npm run dev              # Start dev server with Turbopack
npm run dev-https        # Start dev server with HTTPS on port 9002
```

### Build & Test
```bash
npm run build            # Build for Vercel (standard Next.js)
npm run build:vercel     # Explicitly build for Vercel
npm run build:cloudflare # Build for Cloudflare Workers
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint code linting
```

### Deployment
```bash
npm run deploy:dual      # Deploy to both Vercel and Cloudflare
npm run deploy:all       # Alias for deploy:dual
npm run deploy:cloudflare # Deploy only to Cloudflare Workers
npm run cf:preview       # Preview Cloudflare build locally
npm run cf:login         # Authenticate with Cloudflare
```

### Cloudflare Workers
```bash
npm run start:cloudflare # Start Cloudflare Pages dev server
npm run setup:cicd       # Setup CI/CD configuration
```

## Authentication System

### Dual Authentication Mode
The system supports both plain-text and hashed passwords:
- **Modern**: Uses Supabase RPC `authenticate_user_dual_mode`
- **Legacy**: Falls back to plain-text password comparison
- **Session Management**: JWT tokens with 3-hour expiration
- **Forced Re-login**: Invalidates tokens when passwords are changed

### User Roles
- `admin`: Full system administrator
- `to_qltb`: CDC Equipment Management Team  
- `qltb_khoa`: Department Equipment Manager
- `user`: Regular staff member

## Database Connection

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=https://ltvojwauucztmanidfcb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Database Schema Notes
- All table/field names are in Vietnamese
- Equipment table: `thiet_bi` with fields like `ma_thiet_bi` (equipment code)
- User table: `nhan_vien` (staff) with role-based permissions
- Maintenance uses monthly boolean fields (`thang_1`, `thang_2`, etc.)

## Key Patterns & Conventions

### Component Organization
- Feature components in `/components/[feature-name]/`
- Shared UI components in `/components/ui/`
- Mobile-specific components prefixed with `mobile-`

### Data Fetching
- Uses TanStack React Query for server state
- Custom hooks in `/hooks/` for cached data (`use-cached-equipment.ts`)
- Supabase client in `/lib/supabase.ts`

### Styling
- Primary color: `#438797` (professional medical theme)
- Background: `#d1eaf2` (light medical theme)
- Accent: `#58a7b3`
- Uses Tailwind CSS with custom color scheme

### State Management
- React Query for server state
- React Context for language and realtime features
- Local state with useState/useReducer for UI state

## Mobile & PWA

### Progressive Web App
- Configured with `next-pwa`
- Installable on mobile devices  
- Offline support for cached data
- Service worker in `/public/`

### Mobile Optimization
- Responsive design with mobile-first approach
- Touch-friendly interface
- QR scanner using device camera
- Mobile navigation patterns

## Development Notes

### Equipment page (global/admin) – Reduced initial DB queries
- Initial equipment list fetch is gated for global/admin until a tenant is selected.
- Users see a tip: "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị".
- Tenant selection is persisted in localStorage (key: `equipment_tenant_filter`).
  - Values: `unset` (no fetch), `all` (all tenants), or a numeric tenant id.
  - To reset, pick "— Chọn đơn vị —" or clear the localStorage key.
- TanStack Query is used with `enabled` gating and cache partitioning by `{ tenant: 'unset'|'all'|id }`.

### TypeScript Configuration
- Strict mode enabled
- Excludes test files, AI utilities, and Firebase files
- Path mapping: `@/*` → `./src/*`

### Next.js Configuration
- Turbopack for development
- PWA integration
- Image optimization disabled for Cloudflare Workers
- Dual deployment configuration

### Package Manager
Use **npm** instead of pnpm for package management (per user preference).

## Testing Equipment Features

### QR Code Testing
The system includes QR code generation and scanning. Test by:
1. Navigate to equipment details
2. Generate QR code label
3. Use QR scanner page to scan the code
4. Verify equipment information displays correctly

### Maintenance Planning
Test the monthly maintenance tracking:
1. Create maintenance plan for current year
2. Add tasks for specific equipment
3. Mark tasks complete using monthly checkboxes
4. Verify completion tracking and date stamps

## Common Debugging

### Authentication Issues
- Check Supabase environment variables
- Verify user exists in `nhan_vien` table
- Check password format (plain-text vs hashed)
- Examine NextAuth JWT token structure

### Database Connection
- Confirm Supabase URL and keys are correct
- Check network connectivity to Supabase
- Verify table permissions and RLS policies

### Build Issues
- TypeScript: Run `npm run typecheck`
- Cloudflare compatibility: Check Node.js API usage
- PWA: Verify service worker registration