import * as Onboarding from '@/components/onboarding'

describe('onboarding barrel public API', () => {
  it.each(['HelpButton', 'TOUR_CONFIGS', 'TOUR_IDS'])('does not expose %s', (name) => {
    expect(name in Onboarding).toBe(false)
  })
})
