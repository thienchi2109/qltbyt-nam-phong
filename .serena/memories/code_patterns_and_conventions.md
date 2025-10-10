# Key Code Patterns and Conventions

## RPC Function Template
```sql
CREATE OR REPLACE FUNCTION function_name(
  p_param1 TYPE,
  p_don_vi TEXT DEFAULT NULL
) 
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi TEXT;
BEGIN
  -- Get user context
  v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
  v_user_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';
  
  -- Validate permissions
  IF v_user_role NOT IN ('allowed', 'roles') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Tenant isolation
  IF v_user_role != 'global' THEN
    -- Enforce tenant boundary
  END IF;
  
  -- Business logic here
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

## API Route Pattern
```typescript
// src/app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth/config';

export const runtime = 'nodejs'; // If using Node-specific APIs

export async function POST(req: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Validate role
  if (!['allowed_role'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const body = await req.json();
    
    // Call RPC via proxy
    const result = await fetch('/api/rpc/function_name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_param: body.value })
    });
    
    if (!result.ok) {
      const error = await result.json();
      return NextResponse.json({ error: error.error }, { status: 500 });
    }
    
    const data = await result.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
```

## Page Component Pattern
```typescript
// src/app/(app)/[feature]/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

export default function FeaturePage() {
  const { data: session } = useSession();
  
  // Data fetching with React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature', session?.user.don_vi],
    queryFn: async () => {
      const res = await fetch('/api/rpc/get_feature_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_don_vi: session?.user.don_vi })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      
      return res.json();
    },
    enabled: !!session?.user
  });
  
  // ... component logic
}
```

## Import Order
```typescript
// 1. React/Next.js core
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

// 3. Internal components
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';

// 4. Internal utilities
import { cn } from '@/lib/utils';
import { rpcClient } from '@/lib/rpc-client';

// 5. Types
import type { Equipment, User } from '@/types';
```

## Error Handling Pattern
```typescript
try {
  const result = await rpcClient('function_name', { param: value });
  // Handle success
} catch (error) {
  // RPC client throws Error with best-effort JSON message
  if (error instanceof Error) {
    // Try to parse details
    try {
      const details = JSON.parse(error.message);
      console.error('RPC error:', details);
    } catch {
      console.error('RPC error:', error.message);
    }
  }
  // Show user-friendly message
  toast.error('Operation failed');
}
```

## Multi-Tenant Query Pattern
```typescript
// Always filter by tenant for non-global users
const { data } = useQuery({
  queryKey: ['equipment', session?.user.don_vi],
  queryFn: async () => {
    return rpcClient('get_equipment_list', {
      p_don_vi: session?.user.role === 'global' ? null : session?.user.don_vi,
      p_page: 1,
      p_page_size: 50
    });
  },
  enabled: shouldFetch()
});
```

## Serena Workflow Reminders
- Use `get_symbols_overview` first for understanding code structure
- Use `find_symbol` for targeted symbol reading
- Use `search_for_pattern` for non-symbol content or unknown locations
- Use `replace_regex` with wildcards for efficient editing
- Read memories before starting new tasks to understand context
- Think deeply about multi-tenant implications before any change
