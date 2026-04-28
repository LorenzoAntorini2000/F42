-- Phase 6: any authenticated user can call this to learn a code's status.
-- SECURITY DEFINER bypasses RLS so paired couple rows are also visible,
-- letting us correctly distinguish "already used" from "not found".
CREATE OR REPLACE FUNCTION public.check_invite_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple couples%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_couple FROM public.couples WHERE invite_code = p_code LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'not_found';
  ELSIF v_couple.user_a_id = auth.uid() THEN
    RETURN 'own';
  ELSIF v_couple.user_b_id IS NOT NULL THEN
    RETURN 'used';
  ELSE
    RETURN 'available';
  END IF;
END;
$$;
