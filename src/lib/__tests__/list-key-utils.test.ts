import { toKeyedTexts } from '../list-key-utils'

describe('toKeyedTexts', () => {
  it('returns empty array for empty input', () => {
    expect(toKeyedTexts([])).toEqual([])
  })

  it('gives a single unique string the key text-1', () => {
    const result = toKeyedTexts(['error occurred'])
    expect(result).toEqual([{ key: 'error occurred-1', text: 'error occurred' }])
  })

  it('gives all unique strings deterministic keys with -1 suffix', () => {
    const result = toKeyedTexts(['alpha', 'beta', 'gamma'])
    expect(result).toEqual([
      { key: 'alpha-1', text: 'alpha' },
      { key: 'beta-1', text: 'beta' },
      { key: 'gamma-1', text: 'gamma' },
    ])
  })

  it('gives duplicate strings incrementing suffixes in first-seen order', () => {
    const result = toKeyedTexts(['error', 'error', 'error'])
    expect(result).toEqual([
      { key: 'error-1', text: 'error' },
      { key: 'error-2', text: 'error' },
      { key: 'error-3', text: 'error' },
    ])
  })

  it('handles mixed unique and duplicate strings', () => {
    const result = toKeyedTexts(['foo', 'bar', 'foo', 'baz', 'bar'])
    expect(result).toEqual([
      { key: 'foo-1', text: 'foo' },
      { key: 'bar-1', text: 'bar' },
      { key: 'foo-2', text: 'foo' },
      { key: 'baz-1', text: 'baz' },
      { key: 'bar-2', text: 'bar' },
    ])
  })

  it('preserves input order in output', () => {
    const input = ['c', 'a', 'b']
    const result = toKeyedTexts(input)
    expect(result.map(r => r.text)).toEqual(['c', 'a', 'b'])
  })

  it('produces same keys for same input (deterministic)', () => {
    const input = ['x', 'y', 'x']
    expect(toKeyedTexts(input)).toEqual(toKeyedTexts(input))
  })
})
