
-- Create admin_access whitelist table
CREATE TABLE public.admin_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'demo' CHECK (role IN ('admin', 'demo')),
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create auth_audit log table
CREATE TABLE public.auth_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  user_id uuid,
  result text NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS: only service_role can manage admin_access
ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages admin_access" ON public.admin_access FOR ALL USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);

-- RLS: only service_role can manage auth_audit
ALTER TABLE public.auth_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages auth_audit" ON public.auth_audit FOR ALL USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);

-- Insert your CPF as admin
INSERT INTO public.admin_access (cpf, role, enabled, notes)
VALUES ('55203137846', 'admin', true, 'Owner/admin principal');
