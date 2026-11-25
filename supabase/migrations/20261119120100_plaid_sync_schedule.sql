-- Runs plaid-sync every 4 hours, as a backstop to Plaid's webhooks and to ask
-- Plaid to refresh from TD (free on the Trial plan; see PLAID_REFRESH_ENABLED).
--
-- Needs two Vault secrets, created once in the SQL editor (not in this file,
-- so they never reach git):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as the PLAID_CRON_SECRET function secret>', 'plaid_cron_secret');
--
-- Until both exist the job runs but does nothing.
--
-- Idempotent: safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'plaid-sync') THEN
        PERFORM cron.unschedule('plaid-sync');
    END IF;
END $$;

SELECT cron.schedule(
    'plaid-sync',
    '7 */4 * * *',
    $job$
    SELECT net.http_post(
        url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/plaid-sync',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'plaid_cron_secret')
        ),
        body    := '{"refresh": true}'::jsonb,
        timeout_milliseconds := 120000
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
      AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'plaid_cron_secret');
    $job$
);
