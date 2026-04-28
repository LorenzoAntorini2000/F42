-- Auto-create a profile row whenever a new auth user is inserted.
-- display_name and initials are passed as user metadata at signUp().

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_display_name text;
  v_initials     text;
BEGIN
  v_display_name := COALESCE(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  v_initials := COALESCE(
    new.raw_user_meta_data->>'initials',
    UPPER(
      CASE
        WHEN position(' ' IN v_display_name) > 0
          THEN LEFT(v_display_name, 1) || LEFT(split_part(v_display_name, ' ', 2), 1)
        ELSE LEFT(v_display_name, 2)
      END
    )
  );

  INSERT INTO public.profiles (id, display_name, initials)
  VALUES (new.id, v_display_name, v_initials);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
