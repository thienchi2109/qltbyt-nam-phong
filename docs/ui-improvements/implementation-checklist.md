# Mobile Maintenance Page Redesign - Implementation Checklist

## 📋 Quick Summary

This redesign transforms the Maintenance page from a desktop-adapted mobile view into a **native-app-like mobile experience**. The focus is on:

- ✅ **Touch-first interactions** (44px+ touch targets)
- ✅ **Clear visual hierarchy** (color-coded status headers)
- ✅ **Progressive disclosure** (show essentials, expand for details)
- ✅ **Native patterns** (bottom sheets, sticky headers, active states)
- ✅ **Accessibility** (WCAG 2.1 AA compliant)

---

## 🎯 Key Metrics & Goals

### Target Improvements
- [ ] **50% reduction** in tap errors
- [ ] **30% faster** task completion time
- [ ] **40% increase** in mobile usage
- [ ] **90%+ user satisfaction** score

### Performance Targets
- [ ] First Contentful Paint: < 1.5s
- [ ] Time to Interactive: < 3.5s
- [ ] Largest Contentful Paint: < 2.5s
- [ ] Cumulative Layout Shift: < 0.1

---

## 📦 Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Setup mobile detection and core structure

#### Tasks:
- [ ] **1.1** Add mobile/tablet detection hook
  ```typescript
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  ```

- [ ] **1.2** Create mobile route wrapper
  ```typescript
  if (isMobile) return <MobileMaintenance />
  return <DesktopMaintenance />
  ```

- [ ] **1.3** Setup mobile-specific state management
  - Filter sheet state
  - Expandable card states
  - Search state with debounce

- [ ] **1.4** Install/configure required UI components
  - Sheet (bottom sheet for filters)
  - Enhanced Card components
  - Mobile-optimized Select

#### Deliverables:
- ✅ Mobile detection working
- ✅ Separate mobile component structure
- ✅ Basic routing logic

---

### Phase 2: Header & Search (Week 1-2)
**Goal:** Implement sticky header with integrated search and filters

#### Tasks:
- [ ] **2.1** Create sticky header component
  ```typescript
  <div className="sticky top-0 z-50 bg-white border-b">
    {/* Header content */}
  </div>
  ```

- [ ] **2.2** Implement full-width search bar
  - 44px height (touch-friendly)
  - Clear button (X)
  - Search icon on left
  - Debounced input (300ms)

- [ ] **2.3** Add filter button with badge
  - Shows active filter count
  - Opens bottom sheet

- [ ] **2.4** Create bottom sheet for filters
  - Facility selector (if global/regional)
  - Large touch targets (48px)
  - Clear actions (Apply/Clear)

- [ ] **2.5** Add active filter chips
  - Dismissable badges
  - Shows current filters

#### Deliverables:
- ✅ Sticky header with search
- ✅ Filter bottom sheet
- ✅ Active filter display

---

### Phase 3: Plan Cards Redesign (Week 2)
**Goal:** Create native-app-like plan cards with color coding

#### Tasks:
- [ ] **3.1** Design color-coded status system
  ```typescript
  const getStatusColor = (status) => {
    switch (status) {
      case "Bản nháp": return "bg-amber-50 text-amber-700 border-amber-200"
      case "Đã duyệt": return "bg-green-50 text-green-700 border-green-200"
      case "Không duyệt": return "bg-red-50 text-red-700 border-red-200"
    }
  }
  ```

- [ ] **3.2** Build MobilePlanCard component
  - Color-coded header section
  - Key information rows
  - Action footer (for draft plans)
  - Active state animation (scale on press)

- [ ] **3.3** Implement progressive disclosure
  - Essential info always visible
  - Optional details expandable
  - Clear visual hierarchy

- [ ] **3.4** Add touch feedback
  ```typescript
  className="active:scale-[0.98] transition-transform"
  ```

- [ ] **3.5** Create empty state
  - Friendly illustration/icon
  - Clear CTA
  - Helpful messaging

#### Deliverables:
- ✅ Color-coded plan cards
- ✅ Touch-optimized interactions
- ✅ Empty state component

---

### Phase 4: Mobile Pagination (Week 2)
**Goal:** Implement fixed bottom pagination

#### Tasks:
- [ ] **4.1** Create fixed bottom bar
  ```typescript
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-inset-bottom">
  ```

- [ ] **4.2** Add iOS safe area support
  ```css
  .safe-area-inset-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
  ```

- [ ] **4.3** Design large, equal-width buttons
  - First page (<<)
  - Previous (<)
  - Next (>)
  - Last page (>>)

- [ ] **4.4** Add page information display
  - Current page / Total pages
  - Total item count

- [ ] **4.5** Implement content padding
  - Ensure content doesn't hide behind fixed bar
  - Add pb-20 to content container

#### Deliverables:
- ✅ Fixed bottom pagination
- ✅ Safe area support
- ✅ Large touch targets

---

### Phase 5: Tasks View (Week 3)
**Goal:** Create expandable task cards for mobile

#### Tasks:
- [ ] **5.1** Build MobileTaskCard component
  - Collapsed state (essentials only)
  - Expandable on tap
  - Chevron rotation animation

- [ ] **5.2** Design collapsed view
  - Equipment number badge
  - Equipment name
  - Equipment code + department
  - Scheduled month badges

- [ ] **5.3** Design expanded view
  - Unit assignment
  - Notes
  - Edit/Delete actions

- [ ] **5.4** Add month badges
  ```typescript
  {scheduledMonths.map(month => (
    <Badge variant="outline" className="text-xs">T{month}</Badge>
  ))}
  ```

- [ ] **5.5** Implement expansion state
  - Local state per card
  - Smooth animation
  - Chevron rotation

#### Deliverables:
- ✅ Expandable task cards
- ✅ Progressive disclosure
- ✅ Touch-friendly actions

---

### Phase 6: Changes Indicator (Week 3)
**Goal:** Add visual indicator for unsaved changes

#### Tasks:
- [ ] **6.1** Create warning banner
  ```typescript
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
    <AlertTriangle />
    <span>Có thay đổi chưa lưu</span>
  </div>
  ```

- [ ] **6.2** Add action buttons
  - Cancel (Hủy bỏ)
  - Save (Lưu thay đổi)

- [ ] **6.3** Implement sticky positioning
  - Should stay visible while scrolling
  - Clear visual prominence

- [ ] **6.4** Add loading states
  - Spinner on save button
  - Disable buttons during save

#### Deliverables:
- ✅ Changes warning banner
- ✅ Save/Cancel actions
- ✅ Loading states

---

### Phase 7: Polish & Animations (Week 3-4)
**Goal:** Add final polish and native-like animations

#### Tasks:
- [ ] **7.1** Add loading skeletons
  - Plan cards skeleton
  - Task cards skeleton
  - Smooth content loading

- [ ] **7.2** Implement pull-to-refresh
  - Native mobile pattern
  - Refresh indicator
  - Smooth animation

- [ ] **7.3** Add transition animations
  - Card entrance animations
  - Sheet slide-up animation
  - Smooth state transitions

- [ ] **7.4** Optimize scroll performance
  - Virtual scrolling (if needed)
  - Lazy loading images
  - Debounced scroll events

- [ ] **7.5** Add haptic feedback (if supported)
  ```typescript
  if (window.navigator.vibrate) {
    window.navigator.vibrate(10)
  }
  ```

#### Deliverables:
- ✅ Loading states
- ✅ Smooth animations
- ✅ Optimized performance

---

### Phase 8: Testing & QA (Week 4)
**Goal:** Comprehensive testing across devices

#### Tasks:
- [ ] **8.1** iOS Safari testing
  - iPhone SE (small screen)
  - iPhone 12/13/14 (standard)
  - iPhone 14 Pro Max (large)
  - Safari-specific bugs

- [ ] **8.2** Android Chrome testing
  - Small device (< 5.5")
  - Medium device (5.5" - 6.5")
  - Large device (> 6.5")

- [ ] **8.3** Tablet testing
  - iPad Mini (portrait/landscape)
  - iPad Pro (portrait/landscape)
  - Android tablets

- [ ] **8.4** Touch accuracy testing
  - All buttons 44px+
  - No accidental taps
  - Clear active states

- [ ] **8.5** Accessibility testing
  - Screen reader support
  - Keyboard navigation
  - Color contrast (WCAG AA)
  - Focus indicators

- [ ] **8.6** Performance testing
  - Lighthouse scores
  - Real device testing
  - Network throttling

#### Deliverables:
- ✅ Test report
- ✅ Bug fixes
- ✅ Performance metrics

---

## 🔧 Technical Requirements

### Dependencies
```json
{
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-sheet": "latest", // For bottom sheets
  "framer-motion": "latest", // Optional: for animations
  "react-intersection-observer": "latest" // For lazy loading
}
```

### New Components to Create
1. **MobileMaintenance.tsx** - Main mobile wrapper
2. **MobileHeader.tsx** - Sticky header
3. **MobileFilterSheet.tsx** - Bottom sheet for filters
4. **MobilePlanCard.tsx** - Plan card component
5. **MobileTaskCard.tsx** - Task card component
6. **MobilePagination.tsx** - Fixed bottom pagination
7. **MobileEmptyState.tsx** - Empty state component
8. **MobileSkeleton.tsx** - Loading skeletons

### CSS Utilities to Add
```css
/* Safe area insets */
.safe-area-inset-top {
  padding-top: env(safe-area-inset-top);
}
.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Touch feedback */
.touch-feedback {
  transition: transform 0.1s ease;
}
.touch-feedback:active {
  transform: scale(0.98);
}

/* Status colors */
.status-draft {
  @apply bg-amber-50 text-amber-700 border-amber-200;
}
.status-approved {
  @apply bg-green-50 text-green-700 border-green-200;
}
.status-rejected {
  @apply bg-red-50 text-red-700 border-red-200;
}
```

---

## 📱 Device Support Matrix

| Device | Screen Size | Status | Priority |
|--------|------------|--------|----------|
| iPhone SE | 375x667 | ✅ Supported | High |
| iPhone 12/13/14 | 390x844 | ✅ Supported | High |
| iPhone 14 Pro Max | 430x932 | ✅ Supported | High |
| iPad Mini | 744x1133 | ✅ Supported | Medium |
| iPad Pro | 1024x1366 | ✅ Supported | Medium |
| Android Small | 360x640 | ✅ Supported | High |
| Android Medium | 412x915 | ✅ Supported | High |
| Android Large | 480x1000 | ✅ Supported | High |

---

## 🎨 Design System Tokens

### Colors
```typescript
const colors = {
  status: {
    draft: {
      bg: '#fef3c7',
      text: '#92400e',
      border: '#fde68a',
    },
    approved: {
      bg: '#d1fae5',
      text: '#065f46',
      border: '#a7f3d0',
    },
    rejected: {
      bg: '#fee2e2',
      text: '#991b1b',
      border: '#fecaca',
    },
  },
}
```

### Spacing
```typescript
const spacing = {
  touchTarget: {
    minimum: '44px',
    comfortable: '48px',
    large: '56px',
  },
  padding: {
    container: '1rem', // 16px
    card: '0.75rem', // 12px
    section: '1.5rem', // 24px
  },
}
```

### Typography
```typescript
const typography = {
  mobile: {
    h1: 'text-xl font-bold leading-tight', // 20px
    h2: 'text-lg font-semibold leading-tight', // 18px
    h3: 'text-base font-semibold', // 16px
    body: 'text-sm', // 14px
    caption: 'text-xs', // 12px
  },
}
```

---

## 🚀 Launch Strategy

### Week 1-2: Development
- [ ] Implement Phases 1-4
- [ ] Internal testing
- [ ] Code review

### Week 3: Polish & Testing
- [ ] Implement Phases 5-7
- [ ] QA testing
- [ ] Performance optimization

### Week 4: Beta Launch
- [ ] Deploy to 10% of mobile users
- [ ] Monitor analytics
- [ ] Collect user feedback
- [ ] Fix critical bugs

### Week 5-6: Gradual Rollout
- [ ] 25% of mobile users
- [ ] 50% of mobile users
- [ ] 75% of mobile users
- [ ] Monitor metrics at each stage

### Week 7: Full Launch
- [ ] 100% rollout
- [ ] Monitor support tickets
- [ ] Celebrate! 🎉

---

## 📊 Success Criteria

### Must Have (Phase 1 Launch)
- ✅ All touch targets ≥ 44px
- ✅ Color-coded status headers
- ✅ Sticky header with search
- ✅ Fixed bottom pagination
- ✅ Basic empty states
- ✅ Core functionality working

### Should Have (Phase 2 Polish)
- ✅ Bottom sheet for filters
- ✅ Expandable task cards
- ✅ Active state animations
- ✅ Loading skeletons
- ✅ Pull-to-refresh

### Nice to Have (Future Iterations)
- ⭕ Swipe gestures
- ⭕ Offline support
- ⭕ Push notifications
- ⭕ Dark mode
- ⭕ Haptic feedback

---

## 🐛 Known Limitations & Workarounds

### Limitation 1: iOS Safari Sticky Header
**Issue:** Sticky positioning can be buggy with iOS Safari's elastic scroll.
**Workaround:** Use `position: -webkit-sticky` and test thoroughly.

### Limitation 2: Bottom Sheet on Older Devices
**Issue:** Some older Android devices have slow animations.
**Workaround:** Add reduced-motion media query support.

### Limitation 3: Safe Area Insets
**Issue:** Not all browsers support `env(safe-area-inset-*)`.
**Workaround:** Provide fallback padding values.

---

## 📝 Maintenance Plan

### Weekly Tasks
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Review user feedback
- [ ] Update dependencies

### Monthly Tasks
- [ ] Run full test suite
- [ ] Audit accessibility
- [ ] Review analytics
- [ ] Plan improvements

### Quarterly Tasks
- [ ] Major dependency updates
- [ ] Design system review
- [ ] User research
- [ ] Feature enhancements

---

## 📚 Resources

### Design References
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Mobile](https://material.io/design/platform-guidance/android-mobile.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Code References
- Equipment page mobile implementation (similar patterns)
- Dashboard mobile cards (reference design)
- Existing mobile components library

### Testing Tools
- Chrome DevTools Mobile Emulation
- iOS Simulator (Xcode)
- Android Studio Emulator
- BrowserStack (cross-device testing)
- Lighthouse (performance)

---

## ✅ Final Checklist

Before launch, ensure:

- [ ] All phases completed
- [ ] QA sign-off
- [ ] Performance metrics met
- [ ] Accessibility audit passed
- [ ] Browser testing complete
- [ ] Documentation updated
- [ ] Stakeholder approval
- [ ] Feature flag configured
- [ ] Rollback plan ready
- [ ] Monitoring in place

---

## 🎉 Post-Launch

After successful launch:

1. **Monitor metrics daily** for first week
2. **Collect user feedback** via surveys
3. **Iterate based on data** and feedback
4. **Plan Phase 2 enhancements**
5. **Document learnings** for future projects

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** Ready for Implementation

---

## Contact & Support

For questions or issues during implementation:
- Technical Lead: [Name]
- Design Lead: [Name]
- PM: [Name]

Let's build an amazing mobile experience! 🚀📱
