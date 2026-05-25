import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

function nativeButtonTags(source: string) {
  return source.match(/<button\b[\s\S]*?>/g) ?? []
}

describe('React Doctor quick-win source guards', () => {
  it.each([
    'src/app/(app)/device-quota/mapping/_components/SuggestedMappingUnmatchedSection.tsx',
    'src/app/(app)/equipment/_components/EquipmentPageClient.tsx',
    'src/components/chart-fallbacks.tsx',
    'src/components/transfers/TransfersKanbanView.tsx',
  ])('sets explicit native button types in %s', (relativePath) => {
    const source = readSource(relativePath)
    const buttons = nativeButtonTags(source)

    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons).toEqual(
      buttons.map((button) => expect.stringMatching(/\btype=(?:"button"|'button')/)),
    )
  })

  it('keeps the assistant composer textarea accessible by name', () => {
    const source = readSource('src/components/assistant/AssistantComposer.tsx')

    expect(source).toMatch(/<textarea[\s\S]*\baria-label="Nhập câu hỏi cho trợ lý AI"/)
  })

  it('keeps printable maintenance form controls accessible by name', () => {
    const source = readSource('src/components/maintenance-form.tsx')

    expect(source).toMatch(/aria-label="Năm lập kế hoạch bảo trì"/)
    expect(source).toMatch(/aria-label={`Thực hiện nội bộ cho \$\{formatValue\(device\.name\)\}`}/)
    expect(source).toMatch(/aria-label={`Thuê ngoài cho \$\{formatValue\(device\.name\)\}`}/)
    expect(source).toMatch(/aria-label="Ngày lập biểu mẫu"/)
    expect(source).toMatch(/aria-label="Tháng lập biểu mẫu"/)
    expect(source).toMatch(/aria-label="Năm lập biểu mẫu"/)
  })
})
