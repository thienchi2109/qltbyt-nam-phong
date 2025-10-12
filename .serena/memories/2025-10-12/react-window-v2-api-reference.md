# react-window v2.2.0 API Reference

**Critical:** Project uses react-window v2.2.0 (NOT v1.x). API is completely different.

## Correct API (v2.2.0)

### Imports
```typescript
import { List, ListImperativeAPI, RowComponentProps, Grid, GridImperativeAPI } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
```

### List Component (Vertical)
```typescript
<List
  listRef={ref}
  rowCount={items.length}
  rowHeight={100}  // or (index) => heights[index]
  rowComponent={({ index, style }) => <div style={style}>...</div>}
  rowProps={{}}
  style={{ height, width }}
  overscanCount={5}
/>
```

### Key Props
- `rowCount` (not itemCount)
- `rowHeight` (not itemSize)
- `rowComponent` (not children render prop)
- `listRef` (not ref)
- `style={{ height, width }}` (not separate props)

## NEVER Use (v1.x only)
- ❌ FixedSizeList
- ❌ VariableSizeList
- ❌ itemCount, itemSize props
- ❌ children as render prop
- ❌ ListChildComponentProps type

## Verification
```bash
npm ls react-window  # Check version (must be 2.x)
Get-Content node_modules\react-window\dist\react-window.d.ts | Select-String "^export"
```

## AutoSizer Integration
```typescript
<AutoSizer>
  {({ height, width }) => (
    <List style={{ height, width }} ... />
  )}
</AutoSizer>
```

## Common Pattern
```typescript
const RowComponent = React.useCallback(
  ({ index, style }: RowComponentProps) => (
    <div style={style}>{renderItem(items[index], index)}</div>
  ),
  [items, renderItem]
)
```

**Always verify package version BEFORE using any react-window API.**
