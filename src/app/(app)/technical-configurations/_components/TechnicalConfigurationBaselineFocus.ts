/** Scrolls a baseline authoring control into view before focusing it. */
export function focusTechnicalConfigurationBaselineElement(target: HTMLElement | null): void {
  target?.scrollIntoView?.({ block: "nearest" })
  target?.focus()
}
