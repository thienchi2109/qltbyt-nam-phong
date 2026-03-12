import * as rrPrefs from '@/lib/rr-prefs'

describe('rr-prefs public API', () => {
  it('exposes the expected helper functions', () => {
    expect(typeof rrPrefs.getColumnVisibility).toBe('function')
    expect(typeof rrPrefs.setColumnVisibility).toBe('function')
    expect(typeof rrPrefs.getTableDensity).toBe('function')
    expect(typeof rrPrefs.setTableDensity).toBe('function')
    expect(typeof rrPrefs.getTextWrap).toBe('function')
    expect(typeof rrPrefs.setTextWrap).toBe('function')
    expect(typeof rrPrefs.getUiFilters).toBe('function')
    expect(typeof rrPrefs.setUiFilters).toBe('function')
    expect(typeof rrPrefs.getSavedFilterSets).toBe('function')
    expect(typeof rrPrefs.setSavedFilterSets).toBe('function')
  })

  it('does not expose internal storage keys', () => {
    expect('RR_COL_VIS_KEY' in rrPrefs).toBe(false)
    expect('RR_TABLE_DENSITY_KEY' in rrPrefs).toBe(false)
    expect('RR_TEXT_WRAP_KEY' in rrPrefs).toBe(false)
    expect('RR_FILTER_STATE_KEY' in rrPrefs).toBe(false)
    expect('RR_SAVED_FILTERS_PREFIX' in rrPrefs).toBe(false)
  })
})
