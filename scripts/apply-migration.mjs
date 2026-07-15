// Применяет SQL-миграцию через Supabase Management API (эндпоинт database/query).
// Использование: node scripts/apply-migration.mjs supabase/migrations/00XX_name.sql
import { readFileSync } from 'fs';

const env = {};
readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).forEach(l => { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/https?:\/\/([a-z0-9]+)\.supabase\.co.*/, '$1');
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing in .env.local'); process.exit(1); }

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/apply-migration.mjs <path.sql>'); process.exit(1); }
const sql = readFileSync(file, 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) { console.error(`FAILED ${res.status}:`, text.slice(0, 500)); process.exit(1); }
console.log(`APPLIED ${file}  (HTTP ${res.status})`);
console.log('result:', text.slice(0, 300));
