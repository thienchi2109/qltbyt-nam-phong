# React Doctor Full Scan Report (2026-02-25)

## Scan Context
- Tool: `react-doctor v0.0.29`
- Project: `nextn`
- Scope: full repository scan (not diff-only)
- Command used: `node scripts/npm-run.js run react-doctor:verbose`
- Full diagnostics artifact: `C:\Users\admin\AppData\Local\Temp\react-doctor-06bd1c19-812a-4472-b203-91c030aae1b7\diagnostics.json`
- Share link: `https://www.react.doctor/share?p=nextn&s=78&e=9&w=447&f=242`

## Overall Results
- Score: **78 / 100 (Great)**
- Errors: **9**
- Warnings: **447**
- Affected files: **242 / 454**
- Scan duration: **~7.2s**

## Error-level Findings (9)
1. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx:35`
   - Rule: `jsx-a11y/role-has-required-aria-props`
   - Message: ``option` role is missing required aria props `aria-selected`.`

2. `src/app/(app)/reports/page.tsx:105`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render.`

3. `src/app/(app)/reports/page.tsx:109`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render.`

4. `src/app/(app)/reports/page.tsx:120`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render.`

5. `src/components/unified-inventory-chart.tsx:49`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useQuery" is called conditionally. React Hooks must be called in the exact same order in every component render.`

6. `src/components/unified-inventory-chart.tsx:60`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render.`

7. `src/components/unified-inventory-chart.tsx:61`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render.`

8. `src/components/unified-inventory-chart.tsx:75`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render.`

9. `src/components/unified-inventory-chart.tsx:81`
   - Rule: `react-hooks/rules-of-hooks`
   - Message: `React Hook "useEffect" is called conditionally. React Hooks must be called in the exact same order in every component render.`

## Top Warning Categories (by count)
- `knip/exports`: 128
- `knip/types`: 120
- `knip/files`: 55
- `react-doctor/no-giant-component`: 32
- `react-doctor/no-array-index-as-key`: 29
- `jsx-a11y/label-has-associated-control`: 22
- `jsx-a11y/click-events-have-key-events`: 11
- `jsx-a11y/no-static-element-interactions`: 11
