// Loads settings for the sync from .env.local (gitignored) and the account map.

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

export function loadConfig() {
    dotenv.config({ path: join(ROOT, '.env.local'), quiet: true });
    const env = process.env;

    // A service-role key with a VITE_ prefix would be bundled into the public
    // web app by Vite. Refuse to run rather than silently allow that.
    const leaked = Object.keys(env).filter((k) => k.startsWith('VITE_') && /SERVICE/i.test(k));
    if (leaked.length) {
        throw new Error(`${leaked.join(', ')} must not start with VITE_ — Vite would ship it to the browser. Rename it to SUPABASE_SERVICE_ROLE_KEY.`);
    }

    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    // Either a new-style secret key (sb_secret_…) or a legacy service_role key.
    const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const missing = [
        !supabaseUrl && 'SUPABASE_URL (or VITE_SUPABASE_URL)',
        !serviceKey && 'SUPABASE_SECRET_KEY',
        !env.FINSIGHT_USER_ID && 'FINSIGHT_USER_ID',
    ].filter(Boolean);
    if (missing.length) {
        throw new Error(`Missing in .env.local: ${missing.join(', ')}. See scripts/td-sync/README.md → Setup.`);
    }

    // accounts.local.json (gitignored) overrides the committed accounts.json.
    const localPath = join(HERE, 'accounts.local.json');
    const accountsPath = existsSync(localPath) ? localPath : join(HERE, 'accounts.json');
    const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'));
    for (const a of accounts) {
        if (!a.easyweb || !a.finsight || !['chequing', 'visa'].includes(a.kind)) {
            throw new Error(`Bad entry in ${accountsPath}: each needs easyweb, finsight, and kind ("chequing" or "visa").`);
        }
    }

    return {
        supabaseUrl,
        serviceKey,
        userId: env.FINSIGHT_USER_ID,
        dashboardUrl: env.FINSIGHT_DASHBOARD_URL || null,
        accounts,
    };
}
