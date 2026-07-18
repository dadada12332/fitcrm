import { expect, test } from "@playwright/test"

const miniAppData = {
  club: { name: "Основной клуб", city: "Ташкент" },
  client: { fullName: "Амира Тест", telegramFirstName: "Амира" },
  subscriptions: [],
  visits: [],
  classes: [],
  qrToken: null,
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
