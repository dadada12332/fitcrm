// FitCRM Telegram Agent — оркестратор команды агентов через Telegram.
//
// Как это работает:
//   ТГ-сообщение (задача) → воркер запускает Claude Code headless в репо
//   (`claude -p ... --output-format stream-json`) → Claude-ЛИД сам вызывает
//   ролевых субагентов из .claude/agents/ → воркер стримит шаги обратно в чат.
//
// ВАЖНО: воркер выполняет код/правки/деплой от твоего имени. Поэтому он
// отвечает ТОЛЬКО в разрешённом чате и только разрешённым пользователям.
// См. README.md.

import { Bot } from "grammy"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Конфиг ──
const TOKEN       = process.env.TELEGRAM_AGENT_BOT_TOKEN
const ALLOWED     = (process.env.TELEGRAM_ALLOWED_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
const PROJECT_DIR = process.env.PROJECT_DIR || resolve(__dirname, "..")
const CLAUDE_BIN  = process.env.CLAUDE_BIN || "claude"
const MODEL       = process.env.AGENT_MODEL || "" // пусто = дефолт CLI

if (!TOKEN) { console.error("TELEGRAM_AGENT_BOT_TOKEN missing"); process.exit(1) }
if (ALLOWED.length === 0) console.warn("⚠️  TELEGRAM_ALLOWED_IDS пуст — воркер никого не пустит. Заполни в .env")

const bot = new Bot(TOKEN)

// ── Очередь задач (одна за раз — чтобы claude-процессы не мешали друг другу) ──
const queue = []
let busy = false

const short = (s, n = 3800) => (s.length > n ? s.slice(0, n) + "…" : s)
async function processNext() {
  if (busy || queue.length === 0) return
  busy = true
  const job = queue.shift()
  try {
    await runTask(job)
  } catch (e) {
    await job.ctx.reply("❌ Ошибка воркера: " + short(String(e?.message || e), 500)).catch(() => {})
  } finally {
    busy = false
    processNext()
  }
}

async function runTask({ ctx, task }) {
  const chatId = ctx.chat.id
  await ctx.reply(`🧑‍💼 Лид взял задачу в работу:\n«${short(task, 300)}»\n\nЗапускаю команду…`)

  // Живой статус — одно редактируемое сообщение
  let statusMsg = await ctx.reply("⏳ Инициализация…")
  let lastEdit = 0
  const setStatus = async (text) => {
    const now = Date.now()
    if (now - lastEdit < 1500) return
    lastEdit = now
    try { await ctx.api.editMessageText(chatId, statusMsg.message_id, "⏳ " + short(text, 250)) } catch {}
  }

  const AGENT_EMOJI = {
    "qa-tester": "🧪", "security-auditor": "🔒", "ui-designer": "🎨",
    "db-architect": "🗄️", "code-reviewer": "🔍", "general-purpose": "🤖",
  }

  const args = [
    "-p", task,
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions",
  ]
  if (MODEL) args.push("--model", MODEL)

  const child = spawn(CLAUDE_BIN, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let buf = ""
  let finalText = ""

  const handle = async (ev) => {
    if (ev.type === "assistant" && ev.message?.content) {
      for (const b of ev.message.content) {
        if (b.type === "text" && b.text?.trim()) {
          finalText = b.text
          await setStatus("Лид: " + b.text.replace(/\s+/g, " "))
        } else if (b.type === "tool_use") {
          if (b.name === "Task" || b.name === "Agent") {
            const role = b.input?.subagent_type || "агент"
            const desc = b.input?.description || b.input?.prompt || ""
            const emo = AGENT_EMOJI[role] || "🤝"
            await ctx.reply(`${emo} Подключаю ${role}: ${short(String(desc), 200)}`).catch(() => {})
          } else {
            await setStatus(`${b.name}…`)
          }
        }
      }
    } else if (ev.type === "result") {
      const out = ev.result || finalText || "(готово)"
      await ctx.reply("✅ Готово:\n\n" + short(String(out))).catch(() => {})
      try { await ctx.api.editMessageText(chatId, statusMsg.message_id, "✅ Завершено").catch(() => {}) } catch {}
    }
  }

  child.stdout.on("data", (d) => {
    buf += d.toString()
    let i
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      if (!line) continue
      let ev; try { ev = JSON.parse(line) } catch { continue }
      handle(ev)
    }
  })

  let stderr = ""
  child.stderr.on("data", (d) => { stderr += d.toString() })

  await new Promise((res) => {
    child.on("close", async (code) => {
      if (code !== 0 && !finalText) {
        await ctx.reply("❌ Claude завершился с ошибкой (code " + code + ")\n" + short(stderr, 500)).catch(() => {})
      }
      res()
    })
  })
}

// ── Доступ: только разрешённые id ──
bot.use(async (ctx, next) => {
  const uid = String(ctx.from?.id ?? "")
  const cid = String(ctx.chat?.id ?? "")
  if (ALLOWED.length && !ALLOWED.includes(uid) && !ALLOWED.includes(cid)) {
    return // молча игнорируем чужих
  }
  await next()
})

bot.command("start", (ctx) => ctx.reply(
  "👋 Я — оркестратор команды агентов FitCRM.\n\n" +
  "Напиши задачу текстом — лид разберёт её и подключит нужных агентов " +
  "(🧪 QA, 🔒 Security, 🎨 Designer, 🗄️ DB, 🔍 Review), а я буду присылать шаги сюда.\n\n" +
  "Команды: /queue — очередь, /help — помощь."
))
bot.command("help", (ctx) => ctx.reply(
  "Просто опиши задачу, например:\n" +
  "• «Проверь безопасность staff-экшенов»\n" +
  "• «Сделай блок отзывов на лендинге и задеплой»\n" +
  "• «Прогони весь сценарий регистрации и дай отчёт»\n\n" +
  "Задачи выполняются по очереди (одна за раз)."
))
bot.command("queue", (ctx) => ctx.reply(`В очереди: ${queue.length}${busy ? " (+1 выполняется)" : ""}`))

bot.on("message:text", async (ctx) => {
  const task = ctx.message.text.trim()
  if (task.startsWith("/")) return
  queue.push({ ctx, task })
  await ctx.reply(`📝 Задача принята (позиция в очереди: ${queue.length}${busy ? ", идёт другая" : ""}).`)
  processNext()
})

bot.catch((err) => console.error("bot error:", err))

console.log(`FitCRM Telegram Agent запущен. PROJECT_DIR=${PROJECT_DIR}, allowed=${ALLOWED.join(",") || "(никого!)"}`)
bot.start()
