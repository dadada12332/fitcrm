import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8")

describe("mobile navigation drawers", () => {
  it.each([
    "src/components/app/AppShell.tsx",
    "src/components/platform/PlatformShell.tsx",
  ])("implements modal semantics and keyboard focus handling in %s", (relative) => {
    const source = read(relative)

    expect(source).toContain('role="dialog"')
    expect(source).toContain('aria-modal="true"')
    expect(source).toContain('event.key === "Escape"')
    expect(source).toContain('event.key !== "Tab"')
    expect(source).toContain('document.body.style.overflow = "hidden"')
  })
})
