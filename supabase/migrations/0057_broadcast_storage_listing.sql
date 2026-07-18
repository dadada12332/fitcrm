-- Public buckets serve object URLs without a SELECT policy. Removing the broad
-- policy prevents authenticated users from listing every club's campaign files.
drop policy if exists broadcasts_read on storage.objects;
