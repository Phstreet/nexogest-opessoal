-- Remove privilégios que não são necessários para o cliente autenticado.
-- RLS continua controlando SELECT/INSERT/UPDATE/DELETE por auth.uid().
-- TRUNCATE não é protegido por RLS e não deve estar disponível ao papel authenticated.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.nexo_user_data
FROM authenticated;
