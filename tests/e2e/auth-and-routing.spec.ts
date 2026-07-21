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

for (const privateRoute of ["/dashboard", "/clients", "/memberships", "/visits", "/inbox", "/schedule", "/payments", "/reports"]) {
  test(privateRoute + " redirects an anonymous user to login", async ({ page }) => {
    await page.goto(privateRoute)
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
  })
}

for (const apiRoute of ["/api/broadcasts/run", "/api/cron/reconcile", "/api/telegram/daily-report", "/api/telegram/client-support/run"]) {
  test(apiRoute + " reaches its server-to-server authorization boundary", async ({ request }) => {
    const response = await request.get(apiRoute, { maxRedirects: 0 })

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })
}

test("health endpoint reports the database status without authentication", async ({ request }) => {
  const response = await request.get("/api/health")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual(expect.objectContaining({ status: "ok", database: "reachable" }))
})
