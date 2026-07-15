-- Staff invitations table
-- Stores pending invites with a secret token. Supabase sends the email;
-- the link lands on /auth/callback?next=/accept-invite/TOKEN which exchanges
-- the code for a session, then the accept page creates the staff record.

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'trainer',
  invited_by  uuid,                -- auth.users.id of the inviter
  token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can read (token is a 64-char secret — knowing it is authorisation)
CREATE POLICY "Read invite by token" ON public.staff_invitations
  FOR SELECT USING (true);

-- Only active owner/admin of the club can create invitations
CREATE POLICY "Owner or admin can invite" ON public.staff_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE user_id = auth.uid()
        AND club_id = staff_invitations.club_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_staff_invitations_token   ON public.staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_club    ON public.staff_invitations(club_id);
