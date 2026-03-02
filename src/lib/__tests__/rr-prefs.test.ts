import * as rrPrefs from '@/lib/rr-prefs'

describe('rr-prefs public API', () => {
  it('does not expose internal storage keys', () => {
    expect('RR_COL_VIS_KEY' in rrPrefs).toBe(false)
    expect('RR_TABLE_DENSITY_KEY' in rrPrefs).toBe(false)
    expect('RR_TEXT_WRAP_KEY' in rrPrefs).toBe(false)
    expect('RR_FILTER_STATE_KEY' in rrPrefs).toBe(false)
    expect('RR_SAVED_FILTERS_PREFIX' in rrPrefs).toBe(false)
  })
})
