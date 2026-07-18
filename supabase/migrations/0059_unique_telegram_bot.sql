-- Telegram supports one webhook per bot token. If legacy data connected the
-- same bot to several clubs, keep the most recently connected club.
with ranked as (
  select
    ti.club_id,
    row_number() over (
      partition by ti.bot_token
      order by coalesce((c.settings->'tg_bot'->>'connected_at')::timestamptz, ti.updated_at) desc, ti.club_id
    ) as position
  from public.telegram_integrations ti
  join public.clubs c on c.id = ti.club_id
), removed as (
  delete from public.telegram_integrations ti
  using ranked r
  where ti.club_id = r.club_id and r.position > 1
  returning ti.club_id
)
update public.clubs c
set settings = c.settings - 'tg_bot'
where c.id in (select club_id from removed);

alter table public.telegram_integrations
  drop constraint if exists telegram_integrations_bot_token_key;
alter table public.telegram_integrations
  add constraint telegram_integrations_bot_token_key unique (bot_token);
