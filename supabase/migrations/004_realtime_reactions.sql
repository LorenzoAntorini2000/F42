-- Phase 5: reactions DELETE events need the full old row so partner screens can
-- decrement the right emoji count. Without FULL, the payload only carries the PK.
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
