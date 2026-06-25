// One-time endpoint: registers webhook + sets bot commands + menu button.
// Call: GET /api/telegram/setup?secret=fitcrm_setup_2026
export async function GET(req: Request) {
  const url    = new URL(req.url)
  const secret = url.searchParams.get("secret")

  if (secret !== process.env.TELEGRAM_SETUP_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token      = process.env.TELEGRAM_CRM_BOT_TOKEN!
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`
  const hookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""

  const api = (method: string, body: object) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json())

  const [webhook, commands, menuBtn, description] = await Promise.all([
    // 1. Set webhook
    api("setWebhook", {
      url: webhookUrl,
      secret_token: hookSecret || undefined,
      allowed_updates: ["message", "callback_query"],
    }),

    // 2. Set commands list (shown when user types "/" or opens Menu)
    api("setMyCommands", {
      commands: [
        { command: "start", description: "🏠 Главное меню" },
        { command: "menu",  description: "📋 Открыть меню" },
        { command: "sub",   description: "🏋️ Мой абонемент" },
        { command: "qr",    description: "📱 Мой QR-код" },
        { command: "help",  description: "❓ Помощь" },
      ],
    }),

    // 3. Set menu button (hamburger button next to text input)
    api("setChatMenuButton", {
      menu_button: { type: "commands" },
    }),

    // 4. Set bot description
    api("setMyDescription", {
      description:
        "🏋️ FitCRM — приложение вашего фитнес-клуба.\n\nПроверяйте абонемент, историю посещений и получайте QR-код для входа. Нажмите /start для начала.",
    }),
  ])

  return Response.json({ webhook, commands, menuBtn, description })
}
