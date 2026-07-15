export const LANGS = ["ru", "en", "uz"] as const
export type Lang = (typeof LANGS)[number]

export const LANG_LABELS: Record<Lang, string> = { ru: "Русский", en: "English", uz: "O‘zbekcha" }
export const LANG_SHORT: Record<Lang, string> = { ru: "RU", en: "EN", uz: "UZ" }

export const messages = {
  ru: {
    nav: { features: "Возможности", howitworks: "Как работает", pricing: "Цены", login: "Войти", start: "Начать" },
    hero: {
      title1: "Ваш фитнес-клуб,", title2: "готов к работе.",
      subtitle: "FitCRM автоматизирует управление клиентами, абонементами, расписанием и оплатой — всё в одной системе, которая работает 24/7.",
      cta: "Опробовать бесплатно",
    },
    features: {
      title: "Одна платформа — весь клуб под контролем",
      subtitle: "Клиенты, оплаты, расписание и AI-аналитика работают как единая живая система — не набор отдельных инструментов.",
      clients: "Клиенты и абонементы", payments: "Оплаты и касса", ai: "AI Аналитика", schedule: "Расписание · сегодня", core: "ЯДРО",
    },
    why: {
      title1: "Чем FitCRM отличается", title2: "от",
      rivals: ["Excel", "других CRM", "deepen", "FitBase"],
      subtitle: "Мы храним данные, помним о клиентах и подключаем инструменты так, как это делали бы вы — только автоматически.",
      col1t: "Все данные клиента", col1s: "Профиль, абонемент, история, баланс — в одном месте.",
      col2t: "Умная автоматизация", col2s: "Напоминания, отчёты и рутина — система делает сама.",
      col3t: "Интеграции", col3s: "Оплаты, мессенджеры и QR-чекин из коробки.",
    },
    how: {
      title1: "Корпоративные возможности", title2: "для любого клуба",
      subtitle: "От небольшой студии до сети залов — FitCRM масштабируется вместе с вашим бизнесом без дополнительных затрат.",
      cards: [
        { t: "Управление клиентами", d: "Полные профили с историей, балансом и абонементами. Быстрый поиск по любому полю." },
        { t: "Мультифилиальность", d: "Управляйте несколькими залами из одного аккаунта. Своя статистика и настройки для каждого." },
        { t: "Отчёты и аналитика", d: "Выручка, посещаемость, топ-клиенты — все данные в реальном времени с экспортом в Excel." },
        { t: "Безопасность данных", d: "RLS-изоляция, ролевой доступ и AES-256 шифрование. Данные клуба — только у вас." },
        { t: "Уведомления", d: "Telegram-уведомления о долгах, истекающих абонементах и новых регистрациях." },
        { t: "Склад и товары", d: "Учёт инвентаря, контроль остатков и уведомления при низком запасе товаров." },
      ],
    },
    stats: {
      eyebrow: "#01 · ОБЗОР ПЛАТФОРМЫ", title1: "Весь клуб —", title2: "в одном интерфейсе.", cta: "ПОСМОТРЕТЬ ВСЕ ВОЗМОЖНОСТИ",
      tableLabel: "Таблица", posLabel: "Витрина",
      tabs: [
        { t: "ОТЧЁТЫ", d: "Финансы, продажи, посещаемость и долги — детально, с экспортом в Excel." },
        { t: "СКЛАД", d: "Учёт товаров и остатки — таблицей или витриной для быстрых продаж на ресепшене." },
        { t: "РАСПИСАНИЕ", d: "Групповые занятия, тренеры и залы — записи и загрузка в одном календаре." },
        { t: "ПОСЕЩЕНИЯ", d: "QR-чекин и живой журнал: кто сейчас в зале, а кто не пришёл сегодня." },
      ],
    },
    pricing: {
      title: "Тарифы и цены",
      subtitle: "Идеально под любой этап роста клуба. Начните сегодня — без скрытых платежей и без привязки карты.",
      badges: ["Бесплатный период", "Без привязки карты", "Отмена в любой момент"],
      monthly: "Помесячно", yearly: "Год", off: "−20%", perMonth: "сум/мес",
      perYear: (n: string) => `${n} сум в год`, save: "экономия 20%", noVat: "цена за клуб, без НДС",
      trialDays: (n: number) => `${n} дней бесплатно`, free: "Бесплатно", included: "Что включено", popular: "Популярно",
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "Что такое FitCRM?", a: "CRM-система, разработанная специально для фитнес-клубов и студий. Объединяет управление клиентами, абонементами, расписанием, аналитикой и уведомлениями в одной платформе." },
        { q: "Нужно ли устанавливать приложение?", a: "Нет. FitCRM работает в браузере на любом устройстве — компьютере, планшете или смартфоне. Ничего устанавливать не нужно." },
        { q: "Для каких клубов подходит?", a: "Для любых форматов: тренажёрные залы, йога-студии, танцевальные школы, секции единоборств. Работает как для одного зала, так и для сети из 10+ точек." },
        { q: "Как устроен пробный период?", a: "14 дней бесплатно на любом тарифе без привязки карты. После окончания вы выбираете тариф или продолжаете на бесплатном с ограничениями." },
        { q: "Как оплатить подписку?", a: "Payme, Click, банковской картой Visa/Mastercard. Для юридических лиц выставляем счёт." },
        { q: "Есть ли скидка при годовой оплате?", a: "Да, при оплате годовой подписки — скидка 20%. Свяжитесь с командой для оформления." },
        { q: "Насколько безопасны данные клиентов?", a: "Хранение на серверах Supabase (AWS eu-central-1). Шифрование AES-256, Row Level Security, JWT-аутентификация. Данные не передаются третьим лицам." },
        { q: "Кто имеет доступ к данным?", a: "Только сотрудники с назначенной ролью. Гибкая система прав определяет, кто что видит и редактирует. Все действия — в журнале аудита." },
        { q: "Как перенести базу из Excel?", a: "Загрузите CSV/Excel, сопоставьте поля — и все клиенты появятся в системе за несколько минут." },
        { q: "Как настроить Telegram-бота?", a: "В разделе Интеграции → Telegram создайте бота через @BotFather и вставьте токен. Занимает 5 минут." },
        { q: "Есть ли API?", a: "Да, REST API доступен на тарифе Business. Документация предоставляется после подключения." },
      ],
    },
    cta: {
      eyebrow: "НАЧНИТЕ СЕГОДНЯ", title1: "Запустите первый клуб", title2: "уже сегодня",
      subtitle: "Присоединяйтесь к клубам, которые уже автоматизировали свои процессы. Импорт базы, настройка и первый QR-чекин — за один день.",
      ctaPrimary: "Начать бесплатно", ctaSecondary: "Смотреть демо",
      reassurance: "14 дней бесплатно · без привязки карты · отмена в любой момент",
    },
    footer: {
      brand: "FitCRM помогает создавать, управлять и масштабировать фитнес-клубы любого размера — в одной платформе.",
      product: "Продукт", resources: "Ресурсы", company: "Компания",
      l: { features: "Возможности", pricing: "Тарифы", security: "Безопасность", faq: "FAQ", docs: "Документация", blog: "Блог", help: "Помощь", about: "О нас", contacts: "Контакты", terms: "Условия сервиса", privacy: "Конфиденциальность" },
      rights: "Все права защищены.", status: "Все системы работают",
    },
  },

  en: {
    nav: { features: "Features", howitworks: "How it works", pricing: "Pricing", login: "Sign in", start: "Get started" },
    hero: {
      title1: "Your fitness club,", title2: "ready to run.",
      subtitle: "FitCRM automates clients, memberships, scheduling and payments — all in one system that works 24/7.",
      cta: "Try for free",
    },
    features: {
      title: "One platform — your whole club under control",
      subtitle: "Clients, payments, scheduling and AI analytics work as a single living system — not a set of separate tools.",
      clients: "Clients & memberships", payments: "Payments & cashbox", ai: "AI Analytics", schedule: "Schedule · today", core: "CORE",
    },
    why: {
      title1: "How FitCRM is different", title2: "from",
      rivals: ["Excel", "other CRMs", "deepen", "FitBase"],
      subtitle: "We store the data, remember your clients and connect the tools the way you would — just automatically.",
      col1t: "All client data", col1s: "Profile, membership, history, balance — in one place.",
      col2t: "Smart automation", col2s: "Reminders, reports and routine — the system does it for you.",
      col3t: "Integrations", col3s: "Payments, messengers and QR check-in out of the box.",
    },
    how: {
      title1: "Enterprise-grade features", title2: "for any club",
      subtitle: "From a small studio to a chain of gyms — FitCRM scales with your business at no extra cost.",
      cards: [
        { t: "Client management", d: "Full profiles with history, balance and memberships. Instant search by any field." },
        { t: "Multi-location", d: "Manage several gyms from one account. Separate stats and settings for each." },
        { t: "Reports & analytics", d: "Revenue, attendance, top clients — real-time data with Excel export." },
        { t: "Data security", d: "RLS isolation, role-based access and AES-256 encryption. Your club data stays yours." },
        { t: "Notifications", d: "Telegram alerts about debts, expiring memberships and new sign-ups." },
        { t: "Inventory & products", d: "Stock tracking, balance control and low-stock alerts." },
      ],
    },
    stats: {
      eyebrow: "#01 · PLATFORM OVERVIEW", title1: "Your whole club —", title2: "in one interface.", cta: "SEE ALL FEATURES",
      tableLabel: "Table", posLabel: "POS",
      tabs: [
        { t: "REPORTS", d: "Finance, sales, attendance and debts — in detail, with Excel export." },
        { t: "INVENTORY", d: "Product tracking and stock — as a table or a POS grid for fast front-desk sales." },
        { t: "SCHEDULE", d: "Group classes, trainers and rooms — bookings and load in one calendar." },
        { t: "VISITS", d: "QR check-in and a live log: who's in the gym now and who didn't show up today." },
      ],
    },
    pricing: {
      title: "Plans & pricing",
      subtitle: "Perfect for every stage of growth. Start today — no hidden fees and no credit card required.",
      badges: ["Free trial", "No credit card", "Cancel anytime"],
      monthly: "Monthly", yearly: "Yearly", off: "−20%", perMonth: "UZS/mo",
      perYear: (n: string) => `${n} UZS / year`, save: "save 20%", noVat: "per club, VAT excluded",
      trialDays: (n: number) => `${n} days free`, free: "Free", included: "What's included", popular: "Popular",
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "What is FitCRM?", a: "A CRM built specifically for fitness clubs and studios. It combines clients, memberships, scheduling, analytics and notifications in one platform." },
        { q: "Do I need to install an app?", a: "No. FitCRM runs in the browser on any device — computer, tablet or phone. Nothing to install." },
        { q: "Which clubs is it for?", a: "Any format: gyms, yoga studios, dance schools, martial-arts sections. Works for a single gym or a chain of 10+ locations." },
        { q: "How does the trial work?", a: "14 days free on any plan without a credit card. After that you pick a plan or continue on the free tier with limits." },
        { q: "How do I pay?", a: "Payme, Click, Visa/Mastercard. For legal entities we issue an invoice." },
        { q: "Is there a discount for annual billing?", a: "Yes, paying yearly gives a 20% discount. Contact our team to set it up." },
        { q: "How secure is client data?", a: "Stored on Supabase servers (AWS eu-central-1). AES-256 encryption, Row Level Security, JWT auth. Data is never shared with third parties." },
        { q: "Who has access to the data?", a: "Only staff with an assigned role. Flexible permissions define who sees and edits what. Every action is in the audit log." },
        { q: "How do I import from Excel?", a: "Upload a CSV/Excel, map the fields — and all clients appear in the system within minutes." },
        { q: "How do I set up the Telegram bot?", a: "In Integrations → Telegram create a bot via @BotFather and paste the token. Takes 5 minutes." },
        { q: "Is there an API?", a: "Yes, a REST API is available on the Business plan. Documentation is provided after connection." },
      ],
    },
    cta: {
      eyebrow: "START TODAY", title1: "Launch your first club", title2: "today",
      subtitle: "Join clubs that have already automated their operations. Data import, setup and the first QR check-in — in a single day.",
      ctaPrimary: "Get started free", ctaSecondary: "Watch demo",
      reassurance: "14 days free · no credit card · cancel anytime",
    },
    footer: {
      brand: "FitCRM helps you create, manage and scale fitness clubs of any size — in one platform.",
      product: "Product", resources: "Resources", company: "Company",
      l: { features: "Features", pricing: "Pricing", security: "Security", faq: "FAQ", docs: "Documentation", blog: "Blog", help: "Help", about: "About", contacts: "Contacts", terms: "Terms of Service", privacy: "Privacy" },
      rights: "All rights reserved.", status: "All systems operational",
    },
  },

  uz: {
    nav: { features: "Imkoniyatlar", howitworks: "Qanday ishlaydi", pricing: "Narxlar", login: "Kirish", start: "Boshlash" },
    hero: {
      title1: "Fitnes klubingiz,", title2: "ishga tayyor.",
      subtitle: "FitCRM mijozlar, abonementlar, jadval va to‘lovlarni avtomatlashtiradi — barchasi 24/7 ishlaydigan yagona tizimda.",
      cta: "Bepul sinab ko‘rish",
    },
    features: {
      title: "Yagona platforma — butun klub nazorat ostida",
      subtitle: "Mijozlar, to‘lovlar, jadval va AI-tahlil yagona jonli tizim sifatida ishlaydi — alohida vositalar to‘plami emas.",
      clients: "Mijozlar va abonementlar", payments: "To‘lovlar va kassa", ai: "AI Tahlil", schedule: "Jadval · bugun", core: "YADRO",
    },
    why: {
      title1: "FitCRM nimasi bilan farq qiladi", title2: "boshqalardan",
      rivals: ["Excel", "boshqa CRM", "deepen", "FitBase"],
      subtitle: "Biz ma’lumotlarni saqlaymiz, mijozlarni eslab qolamiz va vositalarni siz qilganingizdek ulaymiz — faqat avtomatik tarzda.",
      col1t: "Mijozning barcha ma’lumotlari", col1s: "Profil, abonement, tarix, balans — bir joyda.",
      col2t: "Aqlli avtomatlashtirish", col2s: "Eslatmalar, hisobotlar va rutina — tizim o‘zi bajaradi.",
      col3t: "Integratsiyalar", col3s: "To‘lovlar, messenjerlar va QR-check-in — quti ichida.",
    },
    how: {
      title1: "Korporativ imkoniyatlar", title2: "har qanday klub uchun",
      subtitle: "Kichik studiyadan zallar tarmog‘igacha — FitCRM biznesingiz bilan birga qo‘shimcha xarajatsiz kengayadi.",
      cards: [
        { t: "Mijozlarni boshqarish", d: "Tarix, balans va abonementli to‘liq profillar. Istalgan maydon bo‘yicha tez qidiruv." },
        { t: "Ko‘p filiallilik", d: "Bir nechta zalni bitta akkauntdan boshqaring. Har biri uchun alohida statistika va sozlamalar." },
        { t: "Hisobot va tahlil", d: "Daromad, davomat, top-mijozlar — real vaqtda va Excelga eksport bilan." },
        { t: "Ma’lumotlar xavfsizligi", d: "RLS izolyatsiya, rolli kirish va AES-256 shifrlash. Klub ma’lumotlari faqat sizniki." },
        { t: "Bildirishnomalar", d: "Qarzlar, tugayotgan abonementlar va yangi ro‘yxatlar haqida Telegram-bildirishnomalar." },
        { t: "Ombor va tovarlar", d: "Inventarizatsiya, qoldiqlar nazorati va kam zaxira haqida bildirishnomalar." },
      ],
    },
    stats: {
      eyebrow: "#01 · PLATFORMA SHARHI", title1: "Butun klub —", title2: "bitta interfeysda.", cta: "BARCHA IMKONIYATLARNI KO‘RISH",
      tableLabel: "Jadval", posLabel: "Vitrina",
      tabs: [
        { t: "HISOBOTLAR", d: "Moliya, sotuvlar, davomat va qarzlar — batafsil, Excelga eksport bilan." },
        { t: "OMBOR", d: "Tovarlar hisobi va qoldiqlar — jadval yoki resepshendagi tez sotuv uchun vitrina ko‘rinishida." },
        { t: "JADVAL", d: "Guruh mashg‘ulotlari, murabbiylar va zallar — yozuvlar va yuklama bitta kalendarda." },
        { t: "TASHRIFLAR", d: "QR-check-in va jonli jurnal: hozir zalda kim bor va bugun kim kelmadi." },
      ],
    },
    pricing: {
      title: "Tariflar va narxlar",
      subtitle: "O‘sishning har bosqichi uchun ideal. Bugun boshlang — yashirin to‘lovlarsiz va kartani bog‘lamasdan.",
      badges: ["Bepul davr", "Kartasiz", "Istalgan vaqtda bekor qilish"],
      monthly: "Oylik", yearly: "Yillik", off: "−20%", perMonth: "so‘m/oy",
      perYear: (n: string) => `${n} so‘m / yil`, save: "20% tejash", noVat: "klub uchun narx, QQSsiz",
      trialDays: (n: number) => `${n} kun bepul`, free: "Bepul", included: "Nimalar kiradi", popular: "Ommabop",
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "FitCRM nima?", a: "Fitnes klublari va studiyalari uchun maxsus yaratilgan CRM. Mijozlar, abonementlar, jadval, tahlil va bildirishnomalarni bitta platformada birlashtiradi." },
        { q: "Ilova o‘rnatish kerakmi?", a: "Yo‘q. FitCRM istalgan qurilmada — kompyuter, planshet yoki telefonda brauzerda ishlaydi. Hech narsa o‘rnatish shart emas." },
        { q: "Qaysi klublar uchun mos?", a: "Har qanday format uchun: zallar, yoga studiyalari, raqs maktablari, kurash seksiyalari. Bitta zal yoki 10+ nuqtali tarmoq uchun ishlaydi." },
        { q: "Sinov davri qanday ishlaydi?", a: "Istalgan tarifda kartasiz 14 kun bepul. Tugagach tarifni tanlaysiz yoki cheklovlar bilan bepul tarifda davom etasiz." },
        { q: "Obunani qanday to‘layman?", a: "Payme, Click, Visa/Mastercard kartasi. Yuridik shaxslar uchun hisob-faktura chiqaramiz." },
        { q: "Yillik to‘lovda chegirma bormi?", a: "Ha, yillik to‘lovda 20% chegirma. Rasmiylashtirish uchun jamoamiz bilan bog‘laning." },
        { q: "Mijoz ma’lumotlari qanchalik xavfsiz?", a: "Supabase serverlarida (AWS eu-central-1) saqlanadi. AES-256 shifrlash, Row Level Security, JWT autentifikatsiya. Ma’lumotlar uchinchi shaxslarga berilmaydi." },
        { q: "Ma’lumotlarga kim kira oladi?", a: "Faqat rol biriktirilgan xodimlar. Moslashuvchan huquqlar kim nimani ko‘rishi va tahrirlashini belgilaydi. Har bir amal audit jurnalida." },
        { q: "Exceldan bazani qanday ko‘chiraman?", a: "CSV/Excel yuklang, maydonlarni moslang — va barcha mijozlar bir necha daqiqada tizimda paydo bo‘ladi." },
        { q: "Telegram-botni qanday sozlayman?", a: "Integratsiyalar → Telegram bo‘limida @BotFather orqali bot yarating va tokenni joylang. 5 daqiqa vaqt oladi." },
        { q: "API bormi?", a: "Ha, REST API Business tarifida mavjud. Ulangandan so‘ng hujjatlar taqdim etiladi." },
      ],
    },
    cta: {
      eyebrow: "BUGUN BOSHLANG", title1: "Birinchi klubingizni", title2: "bugun ishga tushiring",
      subtitle: "O‘z jarayonlarini avtomatlashtirgan klublarga qo‘shiling. Baza importi, sozlash va birinchi QR-check-in — bir kunda.",
      ctaPrimary: "Bepul boshlash", ctaSecondary: "Demoni ko‘rish",
      reassurance: "14 kun bepul · kartasiz · istalgan vaqtda bekor qilish",
    },
    footer: {
      brand: "FitCRM istalgan hajmdagi fitnes klublarni yaratish, boshqarish va kengaytirishda yordam beradi — bitta platformada.",
      product: "Mahsulot", resources: "Resurslar", company: "Kompaniya",
      l: { features: "Imkoniyatlar", pricing: "Tariflar", security: "Xavfsizlik", faq: "FAQ", docs: "Hujjatlar", blog: "Blog", help: "Yordam", about: "Biz haqimizda", contacts: "Kontaktlar", terms: "Xizmat shartlari", privacy: "Maxfiylik" },
      rights: "Barcha huquqlar himoyalangan.", status: "Barcha tizimlar ishlamoqda",
    },
  },
}

export type Messages = (typeof messages)["ru"]
