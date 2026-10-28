-- Django owns authorization. Supabase's REST roles must not bypass it.
-- Run after migrations against this application's Supabase database.
DO $$
DECLARE app_table record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Supabase API roles were not found; wrong database?';
  END IF;
  FOR app_table IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND (tablename LIKE 'shop\_%' ESCAPE '\'
        OR tablename LIKE 'auth\_%' ESCAPE '\'
        OR tablename LIKE 'django\_%' ESCAPE '\'
        OR tablename = 'anasym_cache')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', app_table.tablename);
  END LOOP;
END $$;
