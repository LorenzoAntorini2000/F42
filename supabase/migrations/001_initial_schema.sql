-- F42: Initial schema — profiles, couples, feed_entries, reactions
-- RLS policies and Realtime publication included.

-- ── Tables ────────────────────────────────────────────────────────────────────

-- profiles: created BEFORE couples to handle circular FK
-- couple_id FK to couples is added after couples table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text        NOT NULL,
  initials      text        NOT NULL,
  couple_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.couples (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     uuid        NOT NULL REFERENCES public.profiles(id),
  user_b_id     uuid        REFERENCES public.profiles(id),
  invite_code   text        NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Now add the FK from profiles.couple_id → couples.id
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_couple_id_fkey
  FOREIGN KEY (couple_id) REFERENCES public.couples(id);

CREATE TABLE IF NOT EXISTS public.feed_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     uuid        NOT NULL REFERENCES public.couples(id),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id),
  entry_type    text        NOT NULL CHECK (entry_type IN ('meal', 'workout')),
  title         text        NOT NULL,
  kcal          integer,
  protein_g     integer,
  carbs_g       integer,
  fat_g         integer,
  duration_min  integer,
  distance_km   numeric(5,2),
  logged_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid        NOT NULL REFERENCES public.feed_entries(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id),
  emoji         text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, user_id, emoji)
);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions   ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR couple_id IN (
      SELECT couple_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- couples policies
CREATE POLICY "couples_select" ON public.couples FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "couples_insert" ON public.couples FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "couples_update" ON public.couples FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- feed_entries policies
CREATE POLICY "feed_entries_select" ON public.feed_entries FOR SELECT
  USING (
    couple_id IN (
      SELECT couple_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "feed_entries_insert" ON public.feed_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND couple_id IN (
      SELECT couple_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "feed_entries_update" ON public.feed_entries FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "feed_entries_delete" ON public.feed_entries FOR DELETE
  USING (user_id = auth.uid());

-- reactions policies
CREATE POLICY "reactions_select" ON public.reactions FOR SELECT
  USING (
    entry_id IN (
      SELECT fe.id FROM public.feed_entries fe
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE fe.couple_id = p.couple_id
    )
  );

CREATE POLICY "reactions_insert" ON public.reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON public.reactions FOR DELETE
  USING (user_id = auth.uid());

-- ── Realtime publication ───────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
