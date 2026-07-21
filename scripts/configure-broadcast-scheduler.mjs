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
for (const [key, value] of Object.entries(process.env)) {
  if (value && value !== "[REDACTED]") env[key] = value
}

const accessToken = env.SUPABASE_ACCESS_TOKEN
const cronSecret = env.CRON_SECRET
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/https?:\/\/([a-z0-9]+)\.supabase\.co.*/, "$1")
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
if (!accessToken || !projectRef) {
  console.error("SUPABASE_ACCESS_TOKEN or Supabase URL is missing")
  process.exit(1)
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const vaultSecretSql = cronSecret
  ? `delete from vault.secrets where name = 'fitcrm_cron_secret';
select vault.create_secret(${quote(cronSecret)}, 'fitcrm_cron_secret', 'Authorization for FitCRM scheduled jobs');`
  : `do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'fitcrm_cron_secret') then
    raise exception 'fitcrm_cron_secret is missing from Supabase Vault';
  end if;
end $$;`

const sql = `
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

${vaultSecretSql}

select cron.unschedule(jobid)
from cron.job
where jobname = 'fitcrm-broadcasts-every-5m';

select cron.unschedule(jobid)
from cron.job
where jobname = 'fitcrm-client-support-every-10m';

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

select cron.schedule(
  'fitcrm-client-support-every-10m',
  '*/10 * * * *',
  $job$
    select net.http_get(
      url := ${quote(`${appUrl}/api/telegram/client-support/run`)},
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
  const rawDetails = await response.text()
  const details = cronSecret ? rawDetails.replaceAll(cronSecret, "[redacted]") : rawDetails
  console.error(`Scheduler setup failed (HTTP ${response.status}): ${details.slice(0, 800)}`)
  process.exit(1)
}
console.log("Supabase schedulers configured (broadcasts every 5 minutes, client support every 10 minutes).")
