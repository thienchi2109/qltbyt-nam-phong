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

  it('mobile Equipment item uses the shared create-intent helper instead of a hardcoded repair href', () => {
    const source = readSource(sourceFiles[2])

    expect(source).toContain('buildRepairRequestCreateIntentHref')
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
