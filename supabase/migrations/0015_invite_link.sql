-- Make email nullable so link-based invites (no specific email) are supported
ALTER TABLE public.staff_invitations ALTER COLUMN email DROP NOT NULL;
