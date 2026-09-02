import type * as React from "react"

export type HierarchicalEditorSectionDescriptor = Readonly<{
  key: string
  label: string
  ordinal?: React.ReactNode
  summary?: React.ReactNode
  targetRef?: React.RefObject<HTMLElement | null>
}>

export type HierarchicalEditorWorkspaceProps = Readonly<{
  ariaLabel: string
  bodyAriaLabel: string
  toolbar?: React.ReactNode
  sidebar?: React.ReactNode
  children: React.ReactNode
  workspaceTestId?: string
  bodyTestId?: string
  bodyRef?: React.RefObject<HTMLDivElement | null>
  bodyDataAttributes?: Readonly<Record<string, string | undefined>>
  bodyStyle?: React.CSSProperties
  bodyClassName?: string
  contentClassName?: string
}>

export type HierarchicalEditorToolbarProps = Readonly<{
  testId?: string
  leading?: React.ReactNode
  status?: React.ReactNode
  actions?: React.ReactNode
  onSave: () => void
  saveDisabled: boolean
  isSaving?: boolean
  pendingInputDescription?: React.ReactNode
  pendingInputDescriptionId?: string
}>

export type HierarchicalEditorSectionHeaderRenderProps = Readonly<{
  disclosure: React.ReactElement
}>

export type HierarchicalEditorSectionProps = Readonly<{
  sectionKey?: string
  label: string
  disclosureLabel?: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  header: (props: HierarchicalEditorSectionHeaderRenderProps) => React.ReactNode
  children: React.ReactNode
  sectionRef?: React.Ref<HTMLElement>
  disclosureRef?: React.Ref<HTMLButtonElement>
  dataAttributes?: Readonly<Record<string, string | undefined>>
  testId?: string
}>

export type HierarchicalEditorStructureSidebarProps = Readonly<{
  sections: readonly HierarchicalEditorSectionDescriptor[]
  activeKey?: string | null
  expanded?: boolean
  overlay?: boolean
  expandedWidth?: number | string
  onToggle?: () => void
  onSectionSelect?: (sectionKey: string) => void
  ariaLabel?: string
  testId?: string
}>
