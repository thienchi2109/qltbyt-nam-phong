import { readFileSync } from 'node:fs'
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

describe('equipment-linked-request: in-row indicator adoption', () => {
  function readSource(filePath: string) {
    return readFileSync(join(process.cwd(), filePath), 'utf8')
  }

  it('LinkedRequestRowIndicator IS imported by equipment-table-columns', () => {
    const src = readSource('src/components/equipment/equipment-table-columns.tsx')
    expect(src).toMatch(/LinkedRequestRowIndicator/)
    expect(src).toMatch(/equipment-linked-request/)
  })

  it('LinkedRequestRowIndicator IS imported by mobile-equipment-list-item', () => {
    const src = readSource('src/components/mobile-equipment-list-item.tsx')
    expect(src).toMatch(/LinkedRequestRowIndicator/)
  })

  it('LinkedRequestRowIndicator is NOT imported by equipment-actions-menu', () => {
    const src = readSource('src/components/equipment/equipment-actions-menu.tsx')
    expect(src).not.toMatch(/LinkedRequestRowIndicator/)
  })

  it('LinkedRequestRowIndicator does NOT call callRpc or useResolveActiveRepair', () => {
    const src = readSource(
      'src/components/equipment-linked-request/LinkedRequestRowIndicator.tsx',
    )
    expect(src).not.toMatch(/callRpc\(/)
    expect(src).not.toMatch(/useResolveActiveRepair\(/)
  })

  it('LinkedRequestButton is gone from the codebase', () => {
    const { readdirSync, readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const root = join(process.cwd(), 'src')
    const found: string[] = []
    function walk(dir: string) {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, ent.name)
        if (ent.isDirectory()) walk(full)
        else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) {
          if (readFileSync(full, 'utf8').includes('LinkedRequestButton')) found.push(full)
        }
      }
    }
    walk(root)
    const offenders = found.filter((f) => !f.includes('__tests__') && !f.endsWith('.adoption.test.ts'))
    expect(offenders).toEqual([])
  })
})
