# QLTB Nam Phong - Development Patterns Quick Guide

## Common Development Tasks

### Creating New RPC Functions
```sql
-- Template for new RPC functions with tenant security
CREATE OR REPLACE FUNCTION public.function_name(
  p_param TYPE DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
) 
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Tenant isolation logic
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;
  
  -- Validate permissions
  IF v_role NOT IN ('allowed', 'roles') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Business logic here
  -- Remember: WHERE (v_effective_donvi IS NULL OR table.don_vi = v_effective_donvi)
END;
$$;

GRANT EXECUTE ON FUNCTION public.function_name TO authenticated;
```

### Adding New Frontend Components
```typescript
// Component template with proper imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rpcClient } from '@/lib/rpc-client';
import { Button } from '@/components/ui/button';

interface ComponentProps {
  // Define props here
}

export function ComponentName({ ...props }: ComponentProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cache-key', params],
    queryFn: () => rpcClient('function_name', params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

### Adding New API Routes
```typescript
// API route template at src/app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rpcClient } from '@/lib/rpc-client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Validate input
    
    const result = await rpcClient('function_name', {
      ...body,
      // Add tenant parameters if needed
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Database Migration Pattern
```sql
-- Migration file name: YYYYMMDDHHMMSS_description.sql
-- Always make migrations idempotent

-- Check if column exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'table_name' AND column_name = 'column_name'
  ) THEN
    ALTER TABLE table_name ADD COLUMN column_name TYPE;
  END IF;
END $$;

-- Create or replace functions
CREATE OR REPLACE FUNCTION public.function_name(...) ...

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_table_name_column_name ON table_name(column_name);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.function_name TO authenticated;
```

## Common Patterns

### TanStack Query Usage
```typescript
// Standard query pattern
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['cache-key', param1, param2],
  queryFn: () => rpcClient('function_name', { param1, param2 }),
  staleTime: 5 * 60 * 1000, // 5 minutes for most data
  cacheTime: 10 * 60 * 1000, // 10 minutes cache time
});

// Mutation pattern
const mutation = useMutation({
  mutationFn: (params) => rpcClient('function_name', params),
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['cache-key'] });
    // Show success message
    toast.success('Operation completed successfully');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### Form Handling with React Hook Form
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  field1: z.string().min(1, 'Required'),
  field2: z.number().optional(),
});

type FormData = z.infer<typeof schema>;

export function FormComponent() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      field1: '',
      field2: undefined,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await rpcClient('function_name', data);
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields */}
    </form>
  );
}
```

### Error Handling Pattern
```typescript
// RPC Client error handling
try {
  const result = await rpcClient('function_name', params);
  return result;
} catch (error) {
  // Parse error details if available
  const details = error.details ? JSON.parse(error.details) : {};
  const message = details.message || error.message || 'Unknown error';
  
  // Log for debugging
  console.error('RPC Error:', { error, details, params });
  
  // Throw user-friendly error
  throw new Error(message);
}
```

### Cache Invalidation Patterns
```typescript
// Server-side cache invalidation
import { revalidatePath, revalidateTag } from 'next/cache';

// In API routes or server actions
export async function serverAction() {
  // Perform database operation
  await rpcClient('update_function', params);
  
  // Invalidate caches
  revalidatePath('/equipment');
  revalidateTag('equipment-list');
  revalidateTag('dashboard-stats');
}

// Client-side cache invalidation
const queryClient = useQueryClient();

// After mutations
queryClient.invalidateQueries({ queryKey: ['equipment-list'] });
queryClient.refetchQueries({ queryKey: ['dashboard-stats'] });
```

## Security Checklist

### Before Deploying New Features
☐ Add tenant validation to all RPC functions
☐ Update RPC whitelist in `src/app/api/rpc/[fn]/route.ts`
☐ Test with different user roles (global, admin, technician, user)
☐ Verify cross-tenant data isolation
☐ Add proper error handling with user-friendly messages
☐ Update TypeScript interfaces
☐ Run `npm run typecheck` to ensure no TypeScript errors
☐ Test with invalid input to ensure proper validation

### Database Security
☐ All functions use SECURITY DEFINER
☐ SET search_path = public in all functions
☐ Proper GRANT statements for authenticated role
☐ Tenant filtering in all WHERE clauses
☐ Input sanitization and validation

## Performance Guidelines

### Database Queries
☐ Use appropriate indexes for tenant filtering
☐ Implement pagination for large datasets
☐ Use date windowing for historical data
☐ Avoid SELECT *, use specific columns
☐ Use EXPLAIN ANALYZE for slow queries

### Frontend Performance
☐ Implement proper loading states
☐ Use React.memo for expensive components
☐ Optimize re-renders with proper dependencies
☐ Use lazy loading for large components
☐ Implement proper cache strategies

## Testing Guidelines

### Manual Testing Checklist
☐ Test with different user roles
☐ Verify tenant isolation
☐ Test error scenarios
☐ Validate form submissions
☐ Check responsive design
☐ Test with network throttling
☐ Verify accessibility features

This guide provides the essential patterns and checklists for rapid, secure development in the QLTB Nam Phong project.