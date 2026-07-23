-- Keep the enum change in its own transaction. PostgreSQL cannot safely use a
-- newly added enum value until the transaction that adds it is committed.
alter type public.visit_method add value if not exists 'turnstile';
