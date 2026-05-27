CREATE TABLE public.taal_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taal_id text NOT NULL,
  variation text NOT NULL DEFAULT 'theka',
  beat_index integer NOT NULL CHECK (beat_index >= 0 AND beat_index < 64),
  slot_index integer NOT NULL DEFAULT 0 CHECK (slot_index >= 0 AND slot_index < 8),
  sound_id uuid NOT NULL REFERENCES public.library_sounds(id) ON DELETE CASCADE,
  "offset" real NOT NULL DEFAULT 0 CHECK ("offset" >= 0 AND "offset" < 1),
  velocity real NOT NULL DEFAULT 1 CHECK (velocity >= 0 AND velocity <= 2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (taal_id, variation, beat_index, slot_index)
);

CREATE INDEX idx_taal_assignments_lookup ON public.taal_assignments (taal_id, variation);

GRANT SELECT ON public.taal_assignments TO authenticated;
GRANT ALL ON public.taal_assignments TO service_role;

ALTER TABLE public.taal_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view taal assignments"
  ON public.taal_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert taal assignments"
  ON public.taal_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update taal assignments"
  ON public.taal_assignments FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete taal assignments"
  ON public.taal_assignments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_taal_assignments_updated_at
  BEFORE UPDATE ON public.taal_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();