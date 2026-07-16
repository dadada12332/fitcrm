-- 0053: perf-индексы (по baseline-отчёту)

-- stock_movements не имел индекса по club_id → full-scan на складе
create index if not exists idx_stock_movements_club_created
  on public.stock_movements (club_id, created_at desc);

-- частичный индекс под выборку должников (дашборд/отчёты по debt)
create index if not exists idx_clients_debt
  on public.clients (club_id) where debt > 0;

-- дубль trgm-индекса по имени (idx_clients_fullname_trgm == idx_clients_name_trgm) — убрать лишний
drop index if exists public.idx_clients_fullname_trgm;
