import { expect, test } from "@playwright/test"

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe("retention AI copilot", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated retention tests")

  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email!)
    await page.getByRole("textbox", { name: "Пароль", exact: true }).fill(password!)
    await page.getByRole("button", { name: "Войти", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    await page.goto("/retention")
    await expect(page.getByRole("heading", { name: "Удержание", exact: true })).toBeVisible()
  })

  test("opens portfolio and client analysis in a responsive drawer", async ({ page }) => {
    await page.getByRole("button", { name: "Разобрать с AI", exact: true }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByRole("heading", { name: "AI-разбор удержания", exact: true })).toBeVisible()
    await expect(drawer.getByRole("heading", { name: "Разбор очереди удержания", exact: true })).toBeVisible({ timeout: 25_000 })
    await expect(drawer.getByText("Камила Тестова", { exact: true })).toBeVisible()

    const portfolioBounds = await drawer.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, right: rect.right, viewport: window.innerWidth, overflow: element.scrollWidth - element.clientWidth }
    })
    expect(portfolioBounds.left).toBeGreaterThanOrEqual(0)
    expect(portfolioBounds.right).toBeLessThanOrEqual(portfolioBounds.viewport)
    expect(portfolioBounds.overflow).toBeLessThanOrEqual(1)

    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()

    const clientButtons = page.getByRole("button", { name: "AI-разбор", exact: true }).filter({ visible: true })
    const clientButtonCount = await clientButtons.count()
    expect(clientButtonCount).toBeGreaterThan(0)
    await clientButtons.first().click()

    await expect(drawer.getByText("Персональная рекомендация", { exact: true })).toBeVisible({ timeout: 25_000 })
    await expect(drawer.getByText("Черновик сообщения", { exact: true })).toBeVisible()
    await expect(drawer.getByRole("button", { name: "Копировать", exact: true })).toBeVisible()
  })
})
