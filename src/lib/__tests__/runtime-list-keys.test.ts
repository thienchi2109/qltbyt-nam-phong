import {
  buildPerformanceAlertKey,
  buildKeyedAlerts,
  buildKeyedSuggestions,
  buildKeyedTooltipEntries,
  buildPieSliceCells,
} from '../runtime-list-keys'

describe('runtime list key helpers', () => {
  it('buildPerformanceAlertKey includes message to avoid timestamp/type collisions', () => {
    const base = { timestamp: '2026-02-26T20:00:00.000Z', type: 'warning' as const }
    const a = buildPerformanceAlertKey({ ...base, message: 'A' })
    const b = buildPerformanceAlertKey({ ...base, message: 'B' })

    expect(a).toBe('2026-02-26T20:00:00.000Z-warning-A')
    expect(b).toBe('2026-02-26T20:00:00.000Z-warning-B')
    expect(a).not.toBe(b)
  })

  it('buildKeyedSuggestions makes duplicate suggestion strings unique without index keys', () => {
    const keyed = buildKeyedSuggestions([
      'Optimize query',
      'Optimize query',
      'Add cache',
    ])

    expect(keyed.map((item) => item.key)).toEqual([
      'Optimize query-1',
      'Optimize query-2',
      'Add cache-1',
    ])
  })

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

  it('buildKeyedAlerts deduplicates burst alerts with identical timestamp-type-message', () => {
    const burst = { timestamp: '2026-02-26T20:00:00.000Z', type: 'warning' as const, message: 'High latency' }
    const keyed = buildKeyedAlerts([burst, { ...burst }, { ...burst, message: 'Cache miss' }])

    expect(keyed.map((item) => item.key)).toEqual([
      '2026-02-26T20:00:00.000Z-warning-High latency-1',
      '2026-02-26T20:00:00.000Z-warning-High latency-2',
      '2026-02-26T20:00:00.000Z-warning-Cache miss-1',
    ])
    // The original alert objects are preserved
    expect(keyed[0].alert).toBe(burst)
  })
})
