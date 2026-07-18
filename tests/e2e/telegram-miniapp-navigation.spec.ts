import { expect, test } from "@playwright/test"

const miniAppData = {
  club: { name: "Основной клуб", city: "Ташкент" },
  client: { id: "22222222-2222-4222-8222-222222222222", crmFullName: "Таджибаева Камила", telegramName: "Солнышко", telegramFirstName: "Солнышко", telegramPhotoUrl: null },
  subscriptions: [],
  visits: [],
  classes: [],
  qrPass: null,
  qrExpiresAt: null,
  preferences: { expiry_reminders: true, schedule_reminders: true },
  providers: [],
  serverDate: "2026-07-18",
}

test("Mini App returns through in-app and Telegram back buttons", async ({ page }) => {
  await page.route("https://telegram.org/js/telegram-web-app.js?63", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.Telegram={WebApp:{initData:"signed-test-data",colorScheme:"dark",ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},openLink(){},HapticFeedback:{notificationOccurred(){}},BackButton:{show(){window.__backVisible=true},hide(){window.__backVisible=false},onClick(callback){window.__backCallback=callback},offClick(callback){if(window.__backCallback===callback)window.__backCallback=null}}}};`,
    })
  })
  await page.route("**/api/telegram/miniapp/**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(miniAppData) })
  })

  await page.goto("/tg/00000000-0000-0000-0000-000000000000")
  await expect(page.getByText("Быстрые действия")).toBeVisible()
  const navigation = page.getByRole("navigation")

  await navigation.getByRole("button", { name: "Занятия" }).click()
  await expect(page.getByRole("heading", { name: "Расписание" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Вернуться назад" })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __backVisible?: boolean }).__backVisible)).toBe(true)

  await page.getByRole("button", { name: "Вернуться назад" }).click()
  await expect(page.getByText("Быстрые действия")).toBeVisible()

  await navigation.getByRole("button", { name: "Пропуск" }).click()
  await expect(page.getByRole("heading", { name: "QR-пропуск" })).toBeVisible()
  await navigation.getByRole("button", { name: "Профиль" }).click()
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __backCallback?: () => void }).__backCallback?.())
  await expect(page.getByRole("heading", { name: "QR-пропуск" })).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.innerWidth)
})

test("Mini App displays Telegram name and rotates the QR pass", async ({ page }) => {
  let qrRequests = 0
  await page.route("https://telegram.org/js/telegram-web-app.js?63", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.Telegram={WebApp:{initData:"signed-test-data",colorScheme:"dark",ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},openLink(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}}}};`,
    })
  })
  await page.route("**/api/telegram/miniapp/**", async (route) => {
    const body = route.request().postDataJSON() as { action?: string }
    if (body.action === "qr") {
      qrRequests += 1
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        qrPass: "second-dynamic-pass",
        qrExpiresAt: new Date(Date.now() + 30_000).toISOString(),
      }) })
      return
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      ...miniAppData,
      qrPass: "first-dynamic-pass",
      qrExpiresAt: new Date(Date.now() + 1_000).toISOString(),
    }) })
  })

  await page.goto("/tg/00000000-0000-0000-0000-000000000000?tab=pass")
  await expect(page.getByRole("heading", { name: "QR-пропуск" })).toBeVisible()
  const qrImage = page.getByRole("img", { name: "QR-код клиента" })
  await expect(qrImage).toBeVisible()
  const [imageBox, frameBox] = await Promise.all([qrImage.boundingBox(), qrImage.locator("..").boundingBox()])
  expect(imageBox).not.toBeNull()
  expect(frameBox).not.toBeNull()
  expect(imageBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
  expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
  const firstQr = await qrImage.getAttribute("src")
  await expect.poll(() => qrRequests).toBe(1)
  await expect(qrImage).toBeVisible()
  expect(await qrImage.getAttribute("src")).not.toBe(firstQr)
  await expect(page.getByText("Солнышко")).toBeVisible()
  await page.getByRole("navigation").getByRole("button", { name: "Профиль" }).click()
  await expect(page.getByText("Таджибаева Камила")).toBeVisible()
  await expect(page.getByText("ID 22222222")).toBeVisible()
})
