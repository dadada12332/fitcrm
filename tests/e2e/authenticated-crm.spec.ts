import { expect, test } from "@playwright/test"

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe("authenticated CRM", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated CRM smoke tests")

  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email!)
    await page.getByRole("textbox", { name: "Пароль", exact: true }).fill(password!)
    await page.getByRole("button", { name: "Войти", exact: true }).click()
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 })
    test.skip(page.url().includes("/onboarding"), "The configured E2E account has no completed club")
  })

  test("core routes render without crashes or horizontal page overflow", async ({ page }) => {
    const routes = [
      "/dashboard", "/clients", "/memberships", "/visits", "/schedule",
      "/payments", "/warehouse", "/staff", "/reports", "/integrations",
      "/retention", "/settings", "/support",
    ]

    for (const route of routes) {
      await page.goto(route)
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(?:\\?|$)`))
      await expect(page.locator("body")).toBeVisible()
      await expect(page.getByText("Application error")).toHaveCount(0)
      await expect(page.getByText("Internal Server Error")).toHaveCount(0)

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${route} has horizontal page overflow`).toBeLessThanOrEqual(1)
    }
  })
})
