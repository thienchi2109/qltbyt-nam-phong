import { callRpc } from "@/lib/rpc-client"

export interface AddEquipmentTenantOption {
  id: number
  code?: string | null
  name: string
}

interface AddEquipmentTenantListItem {
  id: number
  code?: string | null
  name: string
}

export async function fetchDepartmentNames(): Promise<string[]> {
  const list = await callRpc<{ name: string }[]>({
    fn: "departments_list",
    args: {},
  })

  return (list || []).map((item) => item.name).filter(Boolean)
}

export async function fetchTenantList(): Promise<AddEquipmentTenantOption[]> {
  const list = await callRpc<AddEquipmentTenantListItem[]>({
    fn: "tenant_list",
    args: {},
  })

  return (list || []).map((tenant) => ({
    id: tenant.id,
    code: tenant.code,
    name: tenant.name,
  }))
}

export function findCurrentTenant(
  tenantList: AddEquipmentTenantOption[],
  userDonVi: unknown
): AddEquipmentTenantOption | null {
  if (!userDonVi || !tenantList.length) return null

  return tenantList.find((tenant) => tenant.id === Number(userDonVi)) || null
}
