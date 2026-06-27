# FitCRM — Дизайн-система

Канон: **shadcn/ui (палитра Zinc)** на `@base-ui/react` + Tailwind v4.
Источник токенов: Figma «Shadcn UI / PRO Variables V6.0» → выгрузка в `design/tokens/zinc.json`.
Токены подключены в `src/app/globals.css` (light в `:root`, dark в `.dark`).

> Обязательно к соблюдению при сборке любого нового UI.
> (Примечание: файл `DESIGN.md` в корне — посторонний артефакт про сайт Anthropic, к проекту не относится.)

---

## 1. Токены (используем ТОЛЬКО их, без хардкода hex)

Каждому токену соответствует Tailwind-утилита (через `@theme inline`) и CSS-переменная.

| Назначение | CSS-переменная | Tailwind | Light | Dark |
|---|---|---|---|---|
| Фон страницы | `--bg` | `bg-background` | `#fafafa` | `#09090b` |
| Карточка/поверхность | `--card` | `bg-card` | `#ffffff` | `#18181b` |
| Текст основной | `--foreground` | `text-foreground` | `#09090b` | `#fafafa` |
| Текст вторичный | `--muted-foreground` | `text-muted-foreground` | `#71717a` | `#a1a1aa` |
| Вторичная поверхность | `--muted` / `--secondary` | `bg-muted` `bg-secondary` | `#f4f4f5` | `#27272a` |
| Граница | `--border` | `border-border` | `#e4e4e7` | `#27272a` |
| Поле ввода | `--input` | — | `#e4e4e7` | `#27272a` |
| Primary (тёмная кнопка) | `--primary` / `-foreground` | `bg-primary text-primary-foreground` | `#18181b`/`#fafafa` | `#fafafa`/`#18181b` |
| Опасное действие | `--destructive` / `-foreground` | `bg-destructive` | `#ef4444` | `#7f1d1d` |
| Фокус | `--ring` | `ring-ring` | `#18181b` | `#a1a1aa` |
| Бренд-акцент (синий) | `--brand` | `text-brand` `bg-brand` | `#2563eb` | `#3b82f6` |
| Радиус | `--radius` | — | `0.5rem` | — |

**Графики:** `--chart-1..5` → `#2661d8 #2db789 #e88c30 #af56db #e2366f` (`text-chart-1`…).
**Сайдбар:** `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`.

### Правила
- ❌ Без сырых hex в компонентах (`#020617`, `#2563eb`…). Только токены/утилиты.
- ✅ Тема light/dark — авто через `next-themes` (класс `.dark`). Новый UI обязан работать в обеих.
- ✅ Главная кнопка = `bg-primary text-primary-foreground`. Синий `--brand` — для ссылок/активных вкладок/выделения, не как основной фон кнопок.

### Легаси-алиасы (для старого кода; в новом не использовать)
`--on-dark`→foreground · `--on-dark-soft`→muted-foreground · `--card-2`→muted ·
`--gray-muted`→zinc-400 · `--orange`→brand · `--border-subtle`→тонкая граница · `--bg`→фон.

---

## 2. Компоненты (`src/components/ui/`)

Примитивы на `@base-ui/react`, стиль shadcn. Сначала ищем готовое здесь, инлайн не пишем.

`button` · `input` · `checkbox` · `switch` · `sheet` (дровер) · `card` · `badge` ·
`accordion` · `date-field` · `navigation-menu`.

Чего нет (Select, Textarea, RadioGroup, Tabs, Dropdown, Tooltip…) — добавляем **в `ui/`** в том же стиле, не верстаем по месту.

---

## 3. Работа с Figma
- ДС-файл: «Shadcn UI / PRO Variables» (`lhKDGqQykE351t5nmBaSsE`). Компоненты/спеки — по `node-id` через Figma MCP.
- Точные токены: экспорт переменных (W3C tokens JSON) → `design/tokens/`, значения → `globals.css`.
- Экраны продукта — отдельными Figma-ссылками; собираю из `ui/`-компонентов + токенов, не с нуля.

## 4. Чек-лист нового экрана
- [ ] Только токены/утилиты, без сырых hex.
- [ ] Переиспользованы `ui/`-компоненты; недостающие добавлены в `ui/`.
- [ ] Работает в light и dark.
- [ ] Состояния: hover / focus(ring) / disabled / loading.
- [ ] `npx tsc --noEmit` и `npm run build` — чисто.
