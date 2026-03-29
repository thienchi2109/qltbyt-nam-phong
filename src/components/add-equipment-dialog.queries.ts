import { callRpc } from "@/lib/rpc-client"

export interface AddEquipmentTenantOption {
  id: number
  code?: string | null
  name: string
}

interface AddEquipmentTenantListItem {
  id: number | string
  code?: string | null
  name: string | null
}

function isTenantListItem(value: unknown): value is AddEquipmentTenantListItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    (typeof row.id === "number" || typeof row.id === "string") &&
    (typeof row.name === "string" || row.name === null) &&
    (!("code" in row) || typeof row.code === "string" || row.code === null)
  )
}

export async function fetchDepartmentNames(): Promise<string[]> {
  const list = await callRpc<{ name: string }[]>({
    fn: "departments_list",
    args: {},
  })

  return (list || []).map((item) => item.name).filter(Boolean)
}

export async function fetchTenantList(): Promise<AddEquipmentTenantOption[]> {
  const list = await callRpc<unknown>({
    fn: "tenant_list",
    args: {},
  })

  if (!Array.isArray(list)) {
    return []
  }

  return list.flatMap((tenant) => {
    if (!isTenantListItem(tenant) || !tenant.name?.trim()) {
      return []
    }

    const id = Number(tenant.id)
    if (!Number.isFinite(id)) {
      return []
    }

    return [
      {
        id,
        code: tenant.code ?? null,
        name: tenant.name,
      },
    ]
  })
}

export function findCurrentTenant(
  tenantList: AddEquipmentTenantOption[],
  userDonVi: unknown
): AddEquipmentTenantOption | null {
  if (!userDonVi || !tenantList.length) return null

  return tenantList.find((tenant) => tenant.id === Number(userDonVi)) || null
}
