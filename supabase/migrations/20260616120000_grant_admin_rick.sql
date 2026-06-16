-- Concede acesso de admin ao CPF do dono (Rick / Mohamed)
-- CPF armazenado apenas com dígitos (11 números), igual ao register-user.
INSERT INTO public.admin_access (cpf, role, enabled, notes)
VALUES ('87739860038', 'admin', true, 'Owner/admin')
ON CONFLICT (cpf) DO UPDATE
  SET role = 'admin',
      enabled = true,
      notes = 'Owner/admin';
