import {
  buildKeyedTooltipEntries,
  buildPieSliceCells,
} from '../runtime-list-keys'

describe('runtime list key helpers', () => {
  it('buildKeyedTooltipEntries prefers dataKey, falls back to name, and keeps duplicates unique', () => {
    const keyed = buildKeyedTooltipEntries([
      { dataKey: 'active', value: 10 },
      { dataKey: 'active', value: 8 },
      { name: 'other', value: 3 },
    ])

    expect(keyed.map((item) => item.key)).toEqual([
      'active-1',
      'active-2',
      'other-1',
    ])
  })

  it('buildPieSliceCells derives deterministic non-index keys and preserves color mapping', () => {
    const cells = buildPieSliceCells(
      [
        { name: 'A', value: 1 },
        { name: 'A', value: 2 },
        { name: 'B', value: 3 },
      ],
      'name',
      ['#111', '#222'],
    )

    expect(cells).toEqual([
      { key: 'A-1', fill: '#111' },
      { key: 'A-2', fill: '#222' },
      { key: 'B-1', fill: '#111' },
    ])
  })
})
