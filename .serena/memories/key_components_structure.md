# Key Components and File Structure

## Authentication Components
- `src/contexts/auth-context.tsx` - Main authentication provider
- `src/app/page.tsx` - Login page with Vietnamese interface
- `src/lib/supabase.ts` - Supabase client configuration
- `src/components/change-password-dialog.tsx` - Password change functionality
- `src/components/add-user-dialog.tsx` - User creation
- `src/components/edit-user-dialog.tsx` - User editing

## Main Application Structure
- `src/app/(app)/layout.tsx` - Protected route layout
- `src/app/(app)/dashboard/page.tsx` - Main dashboard
- `src/app/(app)/equipment/page.tsx` - Equipment management
- `src/app/(app)/maintenance/page.tsx` - Maintenance management
- `src/app/(app)/repair-requests/page.tsx` - Repair request management
- `src/app/(app)/transfers/page.tsx` - Equipment transfer management
- `src/app/(app)/users/page.tsx` - User management (admin)
- `src/app/(app)/reports/page.tsx` - Reports and analytics

## Key Dependencies
- All main pages and components use `useAuth` from auth-context
- Department-based filtering throughout application
- Vietnamese language context for UI translations
- React Query for data management and caching
- Comprehensive component library for equipment management workflows

## Database Integration
- All components use Supabase for data operations
- Department filtering integrated at database level
- Role-based access control throughout application