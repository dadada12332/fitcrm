import { expect, test } from "@playwright/test"

const publicAuthRoutes = [
  { path: "/login", heading: "С возвращением!" },
  { path: "/register", heading: "Создайте аккаунт" },
  { path: "/forgot-password", heading: "Восстановление пароля" },
]

for (const route of publicAuthRoutes) {
  test(route.path + " renders without horizontal overflow", async ({ page }) => {
    await page.goto(route.path)

    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  })
}

for (const privateRoute of ["/dashboard", "/clients", "/memberships", "/visits", "/schedule", "/payments", "/reports"]) {
  test(privateRoute + " redirects an anonymous user to login", async ({ page }) => {
    await page.goto(privateRoute)
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
  })
}
