-- Phase 3: policies required for the invite-code pairing flow

-- User B needs to be able to SELECT a couple by invite code before they've joined.
-- Any authenticated user may read unpaired couple rows (invite_code is the secret).
CREATE POLICY "couples_select_unpaired" ON public.couples FOR SELECT
  USING (user_b_id IS NULL AND auth.uid() IS NOT NULL);

-- User B needs to be able to UPDATE a couple to slot themselves in.
-- USING  : row must still be unpaired AND caller must not be the creator
-- WITH CHECK: after the update user_b_id must equal the caller's id
CREATE POLICY "couples_join" ON public.couples FOR UPDATE
  USING  (user_b_id IS NULL AND auth.uid() != user_a_id)
  WITH CHECK (user_b_id = auth.uid());
