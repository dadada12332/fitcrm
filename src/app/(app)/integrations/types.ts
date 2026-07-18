export type TelegramSettings = {
  auto_expiry_3d: boolean
  auto_expiry_1d: boolean
  qr_checkin: boolean
  renewal_reminder: boolean
  class_reminders: boolean
  welcome_enabled: boolean
  welcome_message: string
  expiry_template: string
  payment_template: string
}

export const DEFAULT_TG_SETTINGS: TelegramSettings = {
  auto_expiry_3d: true,
  auto_expiry_1d: true,
  qr_checkin: true,
  renewal_reminder: true,
  class_reminders: true,
  welcome_enabled: true,
  welcome_message: "Привет, {{name}}! 👋\n\nДобро пожаловать в {{club}}.\nВаш абонемент активен до {{expires}}.",
  expiry_template: "{{name}}, ваш абонемент истекает через {{days}} дн.\n\nПродлить: /renew",
  payment_template: "✅ Оплата подтверждена!\n\nСумма: {{amount}} сум\nАбонемент: {{membership}}\nДействует до: {{expires}}",
}
