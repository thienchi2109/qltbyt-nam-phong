/**
 * DeviceQuotaComplianceReport - Quick Integration Example
 *
 * This file demonstrates how to quickly add the compliance report to your dashboard.
 * Copy the relevant sections to your page.tsx or create a new report route.
 */

// ============================================
// Option 1: Add Report Button to Dashboard
// ============================================

// Update: src/app/(app)/device-quota/dashboard/page.tsx

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { DeviceQuotaComplianceReport } from "./_components/DeviceQuotaComplianceReport"
import { useDeviceQuotaDashboardContext } from "./_hooks/useDeviceQuotaDashboardContext"

// Inside your dashboard component:
export function DashboardWithReport() {
  const { complianceSummary } = useDeviceQuotaDashboardContext()
  const [showReport, setShowReport] = useState(false)

  // Get decision details from context
  const decisionId = complianceSummary?.quyet_dinh_id
  const decisionNumber = complianceSummary?.so_quyet_dinh || "N/A"

  // You'll need to fetch facility name separately or add to context
  const facilityName = "Bệnh viện của bạn" // Replace with actual data

  if (showReport && decisionId) {
    return (
      <div>
        <Button
          onClick={() => setShowReport(false)}
          variant="outline"
          className="mb-4"
        >
          ← Quay lại dashboard
        </Button>
        <DeviceQuotaComplianceReport
          decisionId={decisionId}
          facilityName={facilityName}
          decisionNumber={decisionNumber}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Your existing dashboard content */}

      {/* Add this button where you want the report link */}
      {decisionId && (
        <Button
          onClick={() => setShowReport(true)}
          className="mt-4"
        >
          <FileText className="mr-2 h-4 w-4" />
          Xem báo cáo tuân thủ
        </Button>
      )}
    </div>
  )
}

// ============================================
// Option 2: Create Dedicated Report Route
// ============================================

/**
 * Create new file: src/app/(app)/device-quota/reports/[id]/page.tsx
 *
 * This creates a route: /device-quota/reports/123
 * where 123 is the decision ID
 */

// File: src/app/(app)/device-quota/reports/[id]/page.tsx
"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { callRpc } from "@/lib/rpc-client"
import { DeviceQuotaComplianceReport } from "../../dashboard/_components/DeviceQuotaComplianceReport"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Decision {
  id: number
  so_quyet_dinh: string
  don_vi_id: number
  don_vi_name?: string
}

export default function ComplianceReportPage() {
  const params = useParams()
  const { data: session } = useSession()
  const decisionId = parseInt(params.id as string, 10)

  // Fetch decision to get metadata
  const { data: decision, isLoading, isError } = useQuery<Decision>({
    queryKey: ["decision_detail", decisionId],
    queryFn: async () => {
      // You may need to create this RPC or fetch from existing one
      const result = await callRpc<Decision[]>({
        fn: "dinh_muc_decision_by_id", // Replace with actual RPC name
        args: { p_decision_id: decisionId },
      })
      return result?.[0]
    },
    enabled: !!decisionId,
  })

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  if (isError || !decision) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Không tìm thấy quyết định hoặc bạn không có quyền truy cập</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get facility name from session or decision
  const facilityName = decision.don_vi_name || session?.user?.facility_name || "Cơ sở y tế"

  return (
    <div className="container mx-auto py-8">
      <DeviceQuotaComplianceReport
        decisionId={decisionId}
        facilityName={facilityName}
        decisionNumber={decision.so_quyet_dinh}
      />
    </div>
  )
}

// ============================================
// Option 3: Add to Active Decision Card
// ============================================

// Update: src/app/(app)/device-quota/dashboard/_components/DeviceQuotaActiveDecision.tsx

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { FileText } from "lucide-react"

// Add this to the existing component's return JSX:
export function DeviceQuotaActiveDecisionUpdated() {
  // ... existing code ...

  return (
    <Card>
      {/* ... existing CardHeader and CardContent ... */}

      {/* Add this CardFooter */}
      <CardFooter className="border-t pt-4">
        <Link
          href={`/device-quota/reports/${decisionId}`}
          className="w-full"
        >
          <Button variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            Xem báo cáo tuân thủ
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

// ============================================
// Required RPC Function (if not exists)
// ============================================

/**
 * You may need to create this RPC to fetch decision metadata.
 * Add to migration file: supabase/migrations/YYYYMMDD_decision_detail_rpc.sql
 */

/*
CREATE OR REPLACE FUNCTION public.dinh_muc_decision_by_id(
  p_decision_id BIGINT
)
RETURNS TABLE (
  id BIGINT,
  so_quyet_dinh TEXT,
  don_vi_id BIGINT,
  don_vi_name TEXT,
  trang_thai TEXT,
  ngay_hieu_luc DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
BEGIN
  -- Tenant isolation
  RETURN QUERY
  SELECT
    qd.id,
    qd.so_quyet_dinh,
    qd.don_vi_id,
    dv.ten_don_vi AS don_vi_name,
    qd.trang_thai,
    qd.ngay_hieu_luc
  FROM public.quyet_dinh_dinh_muc qd
  INNER JOIN public.don_vi dv ON dv.id = qd.don_vi_id
  WHERE qd.id = p_decision_id
    AND (
      v_role IN ('global', 'admin')
      OR qd.don_vi_id = NULLIF(v_don_vi, '')::BIGINT
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_decision_by_id(BIGINT) TO authenticated;
*/

// ============================================
// Testing Checklist
// ============================================

/**
 * Manual Testing Steps:
 *
 * 1. Navigate to dashboard
 * 2. Click "Xem báo cáo tuân thủ" button
 * 3. Verify report loads with correct data
 * 4. Check all columns display properly
 * 5. Verify date is in Vietnamese format (dd/MM/yyyy)
 * 6. Test print functionality:
 *    - Click "In báo cáo" button
 *    - Check print preview
 *    - Verify A4 layout
 *    - Check borders are black
 *    - Verify signature blocks visible
 * 7. Test error states:
 *    - Invalid decision ID
 *    - No permission to access
 * 8. Test loading states
 *
 * Browser Testing:
 * - Chrome/Edge ✓
 * - Firefox ✓
 * - Safari ⚠️ (check print)
 */
