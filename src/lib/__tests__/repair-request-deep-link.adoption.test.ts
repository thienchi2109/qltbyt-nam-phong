import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const sourceFiles = [
  'src/components/equipment/equipment-actions-menu.tsx',
  'src/app/(app)/dashboard/page.tsx',
  'src/components/mobile-equipment-list-item.tsx',
  'src/app/(app)/qr-scanner/page.tsx',
  'src/components/assistant/AssistantPanel.tsx',
] as const

function readSource(filePath: string) {
  return readFileSync(join(process.cwd(), filePath), 'utf8')
}

describe('repair request create-intent source adoption', () => {
  it('desktop Equipment actions use the shared create-intent helper instead of a hardcoded repair href', () => {
    const source = readSource(sourceFiles[0])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
    expect(source).not.toContain('/repair-requests?action=create&equipmentId=')
  })

  it('Dashboard uses the shared create-intent helper instead of a hardcoded repair href', () => {
    const source = readSource(sourceFiles[1])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
    expect(source).not.toContain('/repair-requests?action=create"')
    expect(source).not.toContain('/repair-requests?action=create&equipmentId=')
  })

  it('mobile Equipment item uses shared repair-request helpers instead of hardcoded repair hrefs', () => {
    const source = readSource(sourceFiles[2])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
    expect(source).toContain('buildRepairRequestsByEquipmentHref')
    expect(source).not.toContain('/repair-requests?equipmentId=')
    expect(source).not.toContain('/repair-requests?action=create&equipmentId=')
  })

  it('QR scanner uses the shared create-intent helper instead of a hardcoded repair href', () => {
    const source = readSource(sourceFiles[3])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
    expect(source).not.toContain('/repair-requests?equipmentId=')
    expect(source).not.toContain('/repair-requests?action=create&equipmentId=')
  })

  it('AssistantPanel uses the shared create-intent helper instead of a hardcoded repair href', () => {
    const source = readSource(sourceFiles[4])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
    expect(source).not.toContain('/repair-requests?action=create')
  })
})

describe('equipment-linked-request row indicator adoption', () => {
  it('imports LinkedRequestRowIndicator only from equipment row surfaces', () => {
    const desktopSource = readSource('src/components/equipment/equipment-table-columns.tsx')
    const mobileSource = readSource('src/components/mobile-equipment-list-item.tsx')
    const actionsMenuSource = readSource('src/components/equipment/equipment-actions-menu.tsx')

    expect(desktopSource).toContain('LinkedRequestRowIndicator')
    expect(desktopSource).toContain('@/components/equipment-linked-request')
    expect(mobileSource).toContain('LinkedRequestRowIndicator')
    expect(actionsMenuSource).not.toContain('LinkedRequestRowIndicator')
  })

  it('keeps LinkedRequestRowIndicator synchronous and free of per-row RPC resolution', () => {
    const source = readSource(
      'src/components/equipment-linked-request/LinkedRequestRowIndicator.tsx',
    )

    expect(source).not.toMatch(/callRpc\(/)
    expect(source).not.toMatch(/useResolveActiveRepair\(/)
  })

  it('does not reintroduce the removed LinkedRequestButton production component', () => {
    const offenders: string[] = []

    function walk(dir: string) {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const relPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(relPath)
          continue
        }

        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
        if (relPath.includes('__tests__')) continue

        const source = readSource(relPath)
        if (source.includes('LinkedRequestButton')) {
          offenders.push(relPath)
        }
      }
    }

    walk('src')

    expect(offenders).toEqual([])
  })
})
