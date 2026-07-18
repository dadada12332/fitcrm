// Configures Supabase Cron to process scheduled broadcasts every five minutes.
// Secrets are read from .env.local and stored in Supabase Vault, never printed.
import { readFileSync } from "node:fs"

const env = {}
for (const source of [new URL("../.env.local", import.meta.url), process.argv[2]].filter(Boolean)) {
  readFileSync(source, "utf8").split(/\r?\n/).forEach((line) => {
    const index = line.indexOf("=")
    if (index > 0 && line.slice(index + 1).trim()) env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")
  })
}

const accessToken = env.SUPABASE_ACCESS_TOKEN
const cronSecret = env.CRON_SECRET
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/https?:\/\/([a-z0-9]+)\.supabase\.co.*/, "$1")
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
if (!accessToken || !cronSecret || !projectRef) {
  console.error("SUPABASE_ACCESS_TOKEN, CRON_SECRET or Supabase URL is missing in .env.local")
  process.exit(1)
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const sql = `
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

delete from vault.secrets where name = 'fitcrm_cron_secret';
select vault.create_secret(${quote(cronSecret)}, 'fitcrm_cron_secret', 'Authorization for FitCRM scheduled jobs');

select cron.unschedule(jobid)
from cron.job
where jobname = 'fitcrm-broadcasts-every-5m';

select cron.schedule(
  'fitcrm-broadcasts-every-5m',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := ${quote(`${appUrl}/api/broadcasts/run`)},
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fitcrm_cron_secret' limit 1)
      ),
      timeout_milliseconds := 55000
    );
  $job$
);
`

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
})
if (!response.ok) {
  const details = (await response.text()).replaceAll(cronSecret, "[redacted]")
  console.error(`Scheduler setup failed (HTTP ${response.status}): ${details.slice(0, 800)}`)
  process.exit(1)
}
console.log("Supabase broadcast scheduler configured (every 5 minutes).")
