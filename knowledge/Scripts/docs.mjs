import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const vault = path.join(root, "knowledge");
const command = process.argv[2] || "help";
const args = process.argv.slice(3);

function git(argsList, fallback = "") {
  try {
    return execFileSync("git", argsList, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return fallback;
  }
}

function read(file) {
  return readFileSync(file, "utf8");
}

function write(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content.endsWith("\n") ? content : content + "\n", "utf8");
}

function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoWeek(dateString = today()) {
  const date = new Date(dateString + "T12:00:00Z");
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

function markdownFiles(dir, excluded = []) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(vault, full);
    if (excluded.some((prefix) => relative === prefix || relative.startsWith(prefix + path.sep))) continue;
    if (entry.isDirectory()) files.push(...markdownFiles(full, excluded));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files.sort();
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) return {};
  const result = {};
  for (const line of content.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

function setFrontmatter(content, field, value) {
  const end = content.indexOf("\n---\n", 4);
  if (!content.startsWith("---\n") || end < 0) throw new Error("Missing frontmatter");
  const head = content.slice(0, end);
  const body = content.slice(end);
  const pattern = new RegExp("^" + field + ":.*$", "m");
  return (pattern.test(head) ? head.replace(pattern, field + ": " + value) : head + "\n" + field + ": " + value) + body;
}

function replaceAuto(file, key, value) {
  const content = read(file);
  const start = "<!-- AUTO:START " + key + " -->";
  const end = "<!-- AUTO:END " + key + " -->";
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error(path.relative(root, file) + ": missing AUTO section " + key);
  }
  const next = content.slice(0, startIndex + start.length) + "\n" + value.trim() + "\n" + content.slice(endIndex);
  if (next !== content) write(file, next);
}

function titleOf(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/^(TASK-\d+|ADR-\d+)\s+[—-]\s+/, "") : "Без названия";
}

const translit = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  const expanded = value.toLowerCase().split("").map((char) => translit[char] || char).join("");
  return expanded.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "item";
}

function nextId(prefix, locations) {
  const pattern = new RegExp("^" + prefix + "-(\\d+)$");
  let highest = 0;
  for (const file of locations.flatMap((dir) => markdownFiles(dir))) {
    const match = (parseFrontmatter(read(file)).id || "").match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return prefix + "-" + String(highest + 1).padStart(4, "0");
}

function hasWork(date) {
  return Boolean(
    git(["log", "--since=" + date + "T00:00:00+05:00", "--format=%H"])
    || git(["status", "--short"]),
  );
}

function commitLines(since, limit = "12") {
  const output = git(["log", "--since=" + since, "-n", limit, "--date=short", "--pretty=format:%h|%ad|%s"]);
  if (!output) return "Нет commits за период.";
  return output.split("\n").map((line) => {
    const parts = line.split("|");
    return "- `" + parts[0] + "` · " + parts[1] + " · " + parts.slice(2).join("|");
  }).join("\n");
}

function changedFiles() {
  const status = git(["status", "--short"]);
  if (!status) return "Нет незакоммиченных файлов.";
  const lines = status.split("\n").filter((line) => line.slice(3) !== ".codex/");
  return lines.length
    ? lines.map((line) => "- `" + line.slice(3) + "` · " + (line.slice(0, 2).trim() || "changed")).join("\n")
    : "Нет незакоммиченных проектных файлов.";
}

function migrationChanges(date) {
  const committed = git(["log", "--since=" + date + "T00:00:00+05:00", "--name-only", "--pretty=format:", "--", "supabase/migrations"]);
  const pending = git(["status", "--short", "--", "supabase/migrations"]);
  const names = [...new Set((committed + "\n" + pending).split("\n")
    .map((line) => line.replace(/^[ MADRCU?!]{1,3}/, "").trim()).filter(Boolean))];
  return names.length ? names.map((name) => "- `" + name + "`").join("\n") : "Нет изменений миграций.";
}

function createDaily(force = false) {
  const date = today();
  const file = path.join(vault, "Daily", date + ".md");
  if (!existsSync(file)) {
    if (!force && !hasWork(date)) {
      console.log("Daily skipped: no Git activity for " + date);
      return null;
    }
    write(file, read(path.join(vault, "Templates", "Daily Note Template.md")).replaceAll("{{date}}", date));
  }
  const branch = git(["branch", "--show-current"], "unknown");
  const head = git(["log", "-1", "--pretty=format:%h %s"], "Нет доступных данных");
  replaceAuto(file, "changed-files", changedFiles());
  replaceAuto(file, "migrations", migrationChanges(date));
  replaceAuto(file, "checks", "Не проверено автоматически. Запишите фактически выполненные build/test проверки вручную.");
  replaceAuto(file, "deploy", "Нет доступных подтверждённых данных о deploy.");
  replaceAuto(file, "commit-history", commitLines(date + "T00:00:00+05:00", "30"));
  replaceAuto(file, "git-summary", "- Branch: `" + branch + "`\n- HEAD: " + head + "\n- Working tree: " + (git(["status", "--short"]) ? "есть изменения" : "clean"));
  console.log("Daily updated: " + path.relative(root, file));
  return file;
}

function taskRecords() {
  const files = markdownFiles(path.join(vault, "Tasks"));
  const current = path.join(vault, "03 Current Task.md");
  if (existsSync(current) && parseFrontmatter(read(current)).id) files.push(current);
  return files.map((file) => {
    const content = read(file);
    const meta = parseFrontmatter(content);
    return {
      file,
      id: meta.id || "",
      type: meta.type || "task",
      status: meta.status || "inbox",
      priority: meta.priority || "P3",
      module: meta.module || "general",
      created: meta.created || "unknown",
      updated: meta.updated || "unknown",
      title: titleOf(content),
      link: path.relative(vault, file).replace(/\\/g, "/").replace(/\.md$/, ""),
    };
  }).filter((task) => task.id);
}

function taskCard(task) {
  return "- " + task.id + " · " + task.title + " · " + task.type + " · " + task.priority
    + " · " + task.module + " · " + task.created + " · [[" + task.link + "]]";
}

const kanbanMap = {
  inbox: "inbox", backlog: "backlog", ready: "ready", "in-progress": "in-progress",
  review: "review", testing: "testing", blocked: "blocked", completed: "done", done: "done",
};

function updateKanban() {
  const groups = {};
  for (const key of Object.values(kanbanMap)) groups[key] = [];
  for (const task of taskRecords()) groups[kanbanMap[task.status] || "inbox"].push(task);
  const file = path.join(vault, "05 Kanban.md");
  for (const key of [...new Set(Object.values(kanbanMap))]) {
    const cards = groups[key].sort((a, b) => a.id.localeCompare(b.id)).map(taskCard);
    replaceAuto(file, "kanban-" + key, cards.length ? cards.join("\n") : "- Нет задач.");
  }
}

function createWeekly() {
  const date = today();
  const week = isoWeek(date);
  const file = path.join(vault, "Weekly", week + ".md");
  if (!existsSync(file)) {
    write(file, read(path.join(vault, "Templates", "Weekly Review Template.md"))
      .replaceAll("{{week}}", week).replaceAll("{{date}}", date));
  }
  const daily = markdownFiles(path.join(vault, "Daily"))
    .filter((item) => isoWeek(path.basename(item, ".md")) === week);
  const dailyLinks = daily.length
    ? daily.map((item) => "- [[" + path.relative(vault, item).replace(/\\/g, "/").replace(/\.md$/, "") + "]]").join("\n")
    : "Нет Daily Notes за неделю.";
  const completed = taskRecords().filter((task) => task.status === "completed");
  replaceAuto(file, "weekly-summary", commitLines("7 days ago", "40"));
  replaceAuto(file, "completed-tasks", completed.length ? completed.map(taskCard).join("\n") : "Нет завершённых task-файлов за период.");
  replaceAuto(file, "daily-notes", dailyLinks);
  console.log("Weekly updated: " + path.relative(root, file));
}

function createTask() {
  const title = args.join(" ").trim();
  if (!title) throw new Error('Usage: npm run docs:task -- "Название"');
  const id = nextId("TASK", [path.join(vault, "Tasks"), vault]);
  const content = read(path.join(vault, "Templates", "Task Template.md"))
    .replaceAll("{{id}}", id).replaceAll("{{type}}", "feature")
    .replaceAll("{{date}}", today()).replaceAll("{{title}}", title);
  const file = path.join(vault, "Tasks", id + "-" + slugify(title) + ".md");
  write(file, content);
  updateKanban();
  console.log("Task created: " + path.relative(root, file));
}

function findById(id, dirs) {
  for (const file of dirs.flatMap((dir) => markdownFiles(dir))) {
    if (parseFrontmatter(read(file)).id === id) return file;
  }
  const current = path.join(vault, "03 Current Task.md");
  return existsSync(current) && parseFrontmatter(read(current)).id === id ? current : null;
}

function closeTask() {
  const id = (args[0] || "").toUpperCase();
  if (!/^TASK-\d{4}$/.test(id)) throw new Error("Usage: npm run docs:close-task -- TASK-0001");
  const file = findById(id, [path.join(vault, "Tasks")]);
  if (!file) throw new Error("Task not found: " + id);
  let content = setFrontmatter(read(file), "status", "completed");
  content = setFrontmatter(content, "updated", today());
  if (path.basename(file) === "03 Current Task.md") {
    content = setFrontmatter(content, "type", "documentation");
    const archived = path.join(vault, "Tasks", "Completed", id + "-" + slugify(titleOf(content)) + ".md");
    write(archived, content);
    write(file, [
      "---", "type: current-task", "status: empty", "updated: " + today(),
      "tags: [fitcrm, tasks]", "---", "", "# Current Task", "",
      "Нет активной задачи. Новую значимую задачу создайте через `npm run docs:task -- \"Название\"` и назначьте её текущей.",
    ].join("\n"));
  } else {
    write(file, content);
    if (!file.includes(path.join("Tasks", "Completed"))) {
      const destination = path.join(vault, "Tasks", "Completed", path.basename(file));
      mkdirSync(path.dirname(destination), { recursive: true });
      renameSync(file, destination);
    }
  }
  updateKanban();
  createDaily(true);
  updateRepositoryState();
  updateChangelog();
  updateHandoff();
  console.log("Task closed: " + id);
}

function decisionRecords() {
  return markdownFiles(path.join(vault, "Decisions")).map((file) => {
    const content = read(file);
    const meta = parseFrontmatter(content);
    return { file, id: meta.id, status: meta.status || "proposed", title: titleOf(content) };
  }).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
}

function updateDecisionIndex() {
  const rows = ["| ADR | Статус | Решение |", "|---|---|---|", ...decisionRecords().map((item) => {
    const link = path.relative(vault, item.file).replace(/\\/g, "/").replace(/\.md$/, "");
    return "| [[" + link + "]] | " + item.status + " | " + item.title + " |";
  })];
  replaceAuto(path.join(vault, "07 Decision Log.md"), "decision-index", rows.join("\n"));
}

function createAdr() {
  const title = args.join(" ").trim();
  if (!title) throw new Error('Usage: npm run docs:adr -- "Название"');
  const id = nextId("ADR", [path.join(vault, "Decisions")]);
  const content = read(path.join(vault, "Templates", "ADR Template.md"))
    .replaceAll("{{id}}", id).replaceAll("{{date}}", today()).replaceAll("{{title}}", title);
  const file = path.join(vault, "Decisions", id + "-" + slugify(title) + ".md");
  write(file, content);
  updateDecisionIndex();
  console.log("ADR created: " + path.relative(root, file));
}

function createIncident() {
  const title = args.join(" ").trim();
  if (!title) throw new Error('Usage: npm run docs:incident -- "Название"');
  const id = nextId("INCIDENT", [path.join(vault, "Incidents")]);
  const content = read(path.join(vault, "Templates", "Incident Postmortem Template.md"))
    .replaceAll("{{id}}", id).replaceAll("{{date}}", today()).replaceAll("{{title}}", title);
  const file = path.join(vault, "Incidents", id + "-" + slugify(title) + ".md");
  write(file, content);
  console.log("Incident created: " + path.relative(root, file));
}

function updateChangelog() {
  replaceAuto(path.join(vault, "06 Changelog.md"), "changelog-candidates",
    "Кандидаты для ручного отбора; не все commits должны попасть в пользовательский changelog.\n\n"
    + commitLines("14 days ago", "30"));
}

function updateRepositoryState() {
  const packageJson = JSON.parse(read(path.join(root, "package.json")));
  const migrations = readdirSync(path.join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).sort();
  const branch = git(["branch", "--show-current"], "unknown");
  const head = git(["log", "-1", "--date=iso-strict", "--pretty=format:%h · %ad · %s"], "Нет доступных данных");
  const status = git(["status", "--short"]);
  replaceAuto(path.join(vault, "02 Current State.md"), "repository-state", [
    "- Версия package: `" + packageJson.version + "`.",
    "- Branch: `" + branch + "`.",
    "- Последний commit: " + head + ".",
    "- Working tree: " + (status ? "есть незакоммиченные изменения." : "clean."),
    "- Миграции в Git: " + migrations.length + "; последняя `" + (migrations.at(-1) || "нет") + "`.",
    "- Последний production deploy: нет доступных подтверждённых данных.",
  ].join("\n"));
}

function updateDashboard() {
  const file = path.join(vault, "00 Dashboard.md");
  replaceAuto(file, "recent-commits", commitLines("14 days ago", "8"));
  replaceAuto(file, "updated-at", today() + " Asia/Tashkent");
}

function updateHandoff() {
  const currentFile = path.join(vault, "03 Current Task.md");
  const currentContent = read(currentFile);
  const current = parseFrontmatter(currentContent);
  const summary = current.id
    ? "[[03 Current Task]] — " + current.id + ", status `" + current.status + "`: " + titleOf(currentContent) + "."
    : "Нет активной задачи. Выберите следующую из [[05 Kanban]].";
  const file = path.join(vault, "10 AI Handoff.md");
  replaceAuto(file, "current-task", summary);
  replaceAuto(file, "recent-changes", commitLines("14 days ago", "10"));
  replaceAuto(file, "updated-at", today() + " Asia/Tashkent");
}

function updateVaultIndex() {
  const groups = new Map();
  for (const file of markdownFiles(vault, ["Templates"])) {
    if (path.basename(file) === "README.md" && path.dirname(file) !== vault) continue;
    const relative = path.relative(vault, file).replace(/\\/g, "/").replace(/\.md$/, "");
    const group = relative.includes("/") ? relative.split("/")[0] : "Главное";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push("- [[" + relative + "]]");
  }
  const content = [...groups.entries()].sort()
    .map(([group, links]) => "## " + group + "\n\n" + links.join("\n")).join("\n\n");
  replaceAuto(path.join(vault, "Architecture", "Vault Index.md"), "vault-index", content);
}

function validate() {
  const errors = [];
  const warnings = [];
  const requiredDirs = [
    "Daily", "Weekly", "Tasks", "Decisions", "Architecture", "Product", "UX", "Database",
    "Infrastructure", "Integrations", "Releases", "Incidents", "Research", "Meetings",
    "Archive", "Templates", "Scripts",
  ];
  const requiredFiles = [
    "00 Dashboard.md", "01 Project Context.md", "02 Current State.md", "03 Current Task.md",
    "04 Roadmap.md", "05 Kanban.md", "06 Changelog.md", "07 Decision Log.md",
    "08 Known Issues.md", "09 Lessons Learned.md", "10 AI Handoff.md",
  ];
  for (const dir of requiredDirs) if (!existsSync(path.join(vault, dir))) errors.push("Missing directory: " + dir);
  for (const file of requiredFiles) if (!existsSync(path.join(vault, file))) errors.push("Missing file: " + file);

  const files = markdownFiles(vault, ["Templates"]);
  const byStem = new Map();
  const ids = new Map();
  for (const file of files) {
    const stem = path.basename(file, ".md");
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(file);
  }
  for (const file of files) {
    const content = read(file);
    const relative = path.relative(vault, file).replace(/\\/g, "/");
    const starts = [...content.matchAll(/<!-- AUTO:START ([^ ]+) -->/g)].map((match) => match[1]).sort();
    const ends = [...content.matchAll(/<!-- AUTO:END ([^ ]+) -->/g)].map((match) => match[1]).sort();
    if (starts.join("|") !== ends.join("|")) errors.push(relative + ": unbalanced AUTO markers");

    const meta = parseFrontmatter(content);
    const needsFrontmatter = /^(0\d|10 AI Handoff|Daily\/|Weekly\/|Tasks\/|Decisions\/|Incidents\/|Releases\/)/.test(relative);
    if (needsFrontmatter && (!meta.type || !meta.updated)) errors.push(relative + ": missing type/updated frontmatter");
    if (/^(Tasks\/|Decisions\/|Incidents\/)/.test(relative) && !meta.id) errors.push(relative + ": missing id");
    if (/^Tasks\//.test(relative)) {
      const taskTypes = ["feature", "bug", "refactor", "performance", "security", "infrastructure", "UX", "product", "research", "documentation"];
      const taskStatuses = ["inbox", "backlog", "ready", "in-progress", "review", "testing", "blocked", "completed", "done"];
      if (!taskTypes.includes(meta.type)) errors.push(relative + ": invalid task type " + meta.type);
      if (!taskStatuses.includes(meta.status)) errors.push(relative + ": invalid task status " + meta.status);
      if (!/^P[0-4]$/.test(meta.priority || "")) errors.push(relative + ": invalid task priority " + meta.priority);
      if (!/^TASK-\d{4}$/.test(meta.id || "")) errors.push(relative + ": invalid task ID " + meta.id);
    }
    if (/^Decisions\//.test(relative) && !/^ADR-\d{4}$/.test(meta.id || "")) {
      errors.push(relative + ": invalid ADR ID " + meta.id);
    }
    if (/^Incidents\//.test(relative) && !/^INCIDENT-\d{4}$/.test(meta.id || "")) {
      errors.push(relative + ": invalid incident ID " + meta.id);
    }
    if (meta.id) {
      if (ids.has(meta.id)) errors.push("Duplicate ID " + meta.id + ": " + ids.get(meta.id) + " and " + relative);
      ids.set(meta.id, relative);
    }

    const secretPatterns = [
      /sb_secret_[A-Za-z0-9_-]{16,}/,
      /service_role\s*[:=]\s*eyJ[A-Za-z0-9_-]{20,}/i,
      /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
      /(?:password|passwd|secret)\s*[:=]\s*["'][^"'{}\s]{12,}["']/i,
    ];
    if (secretPatterns.some((pattern) => pattern.test(content))) errors.push(relative + ": possible secret");

    for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const rawTarget = match[1].split("|")[0].split("#")[0].trim();
      if (!rawTarget) continue;
      const withExt = rawTarget.endsWith(".md") ? rawTarget : rawTarget + ".md";
      const candidates = [path.resolve(path.dirname(file), withExt), path.resolve(vault, withExt)];
      const stemMatches = byStem.get(path.basename(rawTarget)) || [];
      if (!candidates.some(existsSync) && stemMatches.length !== 1) {
        errors.push(relative + ": broken wiki link [[" + rawTarget + "]]");
      }
    }
  }

  for (const legacy of ["README.md", "FITCRM_ARCHITECTURE.md", "FITCRM_PROJECT_DOCUMENTATION.md", "FITCRM_ROADMAP.md", "FITCRM_CHANGELOG.md"]) {
    if (existsSync(path.join(root, legacy))) warnings.push("Historical document requires code verification: " + legacy);
  }
  if (warnings.length) console.log("Warnings:\n" + warnings.map((item) => "- " + item).join("\n"));
  if (errors.length) {
    console.error("Documentation validation failed:\n" + errors.map((item) => "- " + item).join("\n"));
    process.exitCode = 1;
    return false;
  }
  console.log("Documentation validation passed: " + files.length + " notes, " + ids.size + " unique IDs.");
  return true;
}

function sync() {
  createDaily(args.includes("--force"));
  updateRepositoryState();
  updateDashboard();
  updateKanban();
  updateDecisionIndex();
  updateChangelog();
  updateHandoff();
  updateVaultIndex();
  validate();
}

try {
  switch (command) {
    case "daily": createDaily(args.includes("--force")); break;
    case "weekly": createWeekly(); break;
    case "task": createTask(); break;
    case "close-task": closeTask(); break;
    case "adr": createAdr(); break;
    case "incident": createIncident(); break;
    case "changelog": updateChangelog(); break;
    case "handoff": updateHandoff(); break;
    case "validate": validate(); break;
    case "sync": sync(); break;
    case "index": updateVaultIndex(); break;
    default: console.log("Commands: daily, weekly, task, close-task, adr, incident, changelog, handoff, validate, sync, index");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
