import { useRef, useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { useTechnicalConfigurationGroupDisclosure } from "../_hooks/useTechnicalConfigurationGroupDisclosure"

type DisclosureHarnessProps = {
  groupKeys: readonly string[]
}

function DisclosureHarness({ groupKeys }: DisclosureHarnessProps) {
  const [criterionRevision, setCriterionRevision] = useState(0)
  const disclosure = useTechnicalConfigurationGroupDisclosure(groupKeys)
  const initialCallbacks = useRef({
    expand: disclosure.expand,
    isExpanded: disclosure.isExpanded,
    setExpanded: disclosure.setExpanded,
  })
  const initialExpandedGroupKeys = useRef(disclosure.expandedGroupKeys)

  return (
    <div>
      <output data-testid="expanded-group-keys">
        {[...disclosure.expandedGroupKeys].sort().join(",")}
      </output>
      <output data-testid="initial-expanded-group-keys">
        {[...initialExpandedGroupKeys.current].sort().join(",")}
      </output>
      <output data-testid="criterion-revision">{criterionRevision}</output>
      <output data-testid="callbacks-stable">
        {String(
          initialCallbacks.current.expand === disclosure.expand &&
            initialCallbacks.current.isExpanded === disclosure.isExpanded &&
            initialCallbacks.current.setExpanded === disclosure.setExpanded
        )}
      </output>

      {groupKeys.map((groupKey) => (
        <button
          key={groupKey}
          type="button"
          aria-expanded={disclosure.expandedGroupKeys.has(groupKey)}
          onClick={() => disclosure.setExpanded(groupKey, !disclosure.isExpanded(groupKey))}
        >
          {groupKey}
        </button>
      ))}

      <button type="button" onClick={() => setCriterionRevision((revision) => revision + 1)}>
        Sửa tiêu chí
      </button>
      <button type="button" onClick={() => disclosure.expand("group-a")}>
        Mở group-a
      </button>
      <button
        type="button"
        onClick={() => {
          disclosure.setExpanded("group-a", false)
          disclosure.setExpanded("group-b", false)
        }}
      >
        Thu gọn cả hai
      </button>
      <button type="button" onClick={() => disclosure.setExpanded("missing-group", false)}>
        Thu gọn group không tồn tại
      </button>
    </div>
  )
}

describe("useTechnicalConfigurationGroupDisclosure", () => {
  it("expands every initial group", () => {
    render(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("expanded-group-keys")).toHaveTextContent("group-a,group-b")
  })

  it("toggles one group without changing the others and preserves it across ordinary rerenders", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    await user.click(screen.getByRole("button", { name: "group-a" }))
    await user.click(screen.getByRole("button", { name: "Sửa tiêu chí" }))
    rerender(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("criterion-revision")).toHaveTextContent("1")
    expect(screen.getByTestId("callbacks-stable")).toHaveTextContent("true")

    await user.click(screen.getByRole("button", { name: "Mở group-a" }))

    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute("aria-expanded", "true")
  })

  it("expands newly appended groups and removes deleted groups", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    await user.click(screen.getByRole("button", { name: "group-b" }))
    rerender(<DisclosureHarness groupKeys={["group-a", "group-b", "group-c"]} />)

    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "group-c" })).toHaveAttribute("aria-expanded", "true")

    rerender(<DisclosureHarness groupKeys={["group-a", "group-c"]} />)

    expect(screen.queryByRole("button", { name: "group-b" })).not.toBeInTheDocument()
    expect(screen.getByTestId("expanded-group-keys")).toHaveTextContent("group-a,group-c")

    rerender(<DisclosureHarness groupKeys={["group-a", "group-b", "group-c"]} />)

    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute("aria-expanded", "true")
  })

  it("preserves disclosure state by key when existing groups are reordered", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["group-a", "group-b", "group-c"]} />)

    await user.click(screen.getByRole("button", { name: "group-b" }))
    rerender(<DisclosureHarness groupKeys={["group-c", "group-b", "group-a"]} />)

    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "group-c" })).toHaveAttribute("aria-expanded", "true")
  })

  it("treats a server key replacing a client key as new and expanded", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["client-group"]} />)

    await user.click(screen.getByRole("button", { name: "client-group" }))
    rerender(<DisclosureHarness groupKeys={["server-group"]} />)

    expect(screen.queryByRole("button", { name: "client-group" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "server-group" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("does not transfer disclosure state to an unrelated group inserted at the same position", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    await user.click(screen.getByRole("button", { name: "group-a" }))
    rerender(<DisclosureHarness groupKeys={["group-c", "group-b"]} />)

    expect(screen.getByRole("button", { name: "group-c" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute("aria-expanded", "true")
  })

  it("ignores late updates for missing groups so they expand when later inserted", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DisclosureHarness groupKeys={["group-a"]} />)

    await user.click(screen.getByRole("button", { name: "Thu gọn group không tồn tại" }))
    rerender(<DisclosureHarness groupKeys={["group-a", "missing-group"]} />)

    expect(screen.getByRole("button", { name: "missing-group" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("applies batched updates functionally without mutating previous expanded sets", async () => {
    const user = userEvent.setup()
    render(<DisclosureHarness groupKeys={["group-a", "group-b"]} />)

    await user.click(screen.getByRole("button", { name: "Thu gọn cả hai" }))

    expect(screen.getByRole("button", { name: "group-a" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.getByRole("button", { name: "group-b" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.getByTestId("initial-expanded-group-keys")).toHaveTextContent("group-a,group-b")
  })

  it("keeps an empty draft stable", () => {
    const { rerender } = render(<DisclosureHarness groupKeys={[]} />)

    rerender(<DisclosureHarness groupKeys={[]} />)

    expect(screen.getByTestId("expanded-group-keys")).toBeEmptyDOMElement()
    expect(screen.getAllByRole("button")).toHaveLength(4)
  })
})
