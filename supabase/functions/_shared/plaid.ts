// Minimal Plaid API client: JSON over fetch, no SDK.
//
// Secrets (supabase secrets set …):
//   PLAID_CLIENT_ID
//   PLAID_SECRET_SANDBOX      Sandbox secret
//   PLAID_SECRET_PRODUCTION   Production (Trial plan) secret
//   PLAID_ENV                 'sandbox' | 'production': where NEW connections go.
//                             Existing connections always use the env they were made in.

export type PlaidEnv = "sandbox" | "production";

const HOSTS: Record<PlaidEnv, string> = {
    sandbox: "https://sandbox.plaid.com",
    production: "https://production.plaid.com",
};

/** Plaid errors that mean the bank login needs you (Link update mode). */
export const REAUTH_CODES = new Set([
    "ITEM_LOGIN_REQUIRED",
    "PENDING_EXPIRATION",
    "PENDING_DISCONNECT",
    "INVALID_CREDENTIALS",
    "INVALID_MFA",
    "ITEM_LOCKED",
    "USER_SETUP_REQUIRED",
    "INSUFFICIENT_CREDENTIALS",
]);

/** Plaid errors that mean the connection is gone for good. */
export const DEAD_CODES = new Set([
    "ITEM_NOT_FOUND",
    "ACCESS_NOT_GRANTED",
    "INVALID_ACCESS_TOKEN",
    "USER_PERMISSION_REVOKED",
]);

export class PlaidError extends Error {
    code: string;
    type: string;
    status: number;
    requestId: string | null;
    constructor(status: number, body: Record<string, unknown>) {
        super(String(body.error_message ?? body.error_code ?? `Plaid request failed (${status})`));
        this.status = status;
        this.code = String(body.error_code ?? "UNKNOWN");
        this.type = String(body.error_type ?? "UNKNOWN");
        this.requestId = (body.request_id as string) ?? null;
    }
}

/** Where new connections are created. */
export function newConnectionEnv(): PlaidEnv {
    const env = (Deno.env.get("PLAID_ENV") ?? "sandbox").toLowerCase();
    if (env !== "sandbox" && env !== "production") {
        throw new Error(`PLAID_ENV must be 'sandbox' or 'production', not '${env}'.`);
    }
    return env;
}

export function hasCredentials(env: PlaidEnv): boolean {
    return Boolean(Deno.env.get("PLAID_CLIENT_ID") && secretFor(env));
}

function secretFor(env: PlaidEnv): string | undefined {
    return env === "production" ? Deno.env.get("PLAID_SECRET_PRODUCTION") : Deno.env.get("PLAID_SECRET_SANDBOX");
}

// deno-lint-ignore no-explicit-any
export async function plaid<T = any>(env: PlaidEnv, endpoint: string, body: Record<string, unknown>): Promise<T> {
    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = secretFor(env);
    if (!clientId || !secret) {
        throw new Error(`Plaid ${env} credentials aren't set (PLAID_CLIENT_ID, PLAID_SECRET_${env.toUpperCase()}).`);
    }

    const res = await fetch(`${HOSTS[env]}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Plaid-Version": "2020-09-14" },
        body: JSON.stringify({ client_id: clientId, secret, ...body }),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new PlaidError(res.status, Object.keys(json).length ? json : { error_message: text.slice(0, 200) });
    return json as T;
}

/** Countries new connections may pick a bank from (PLAID_COUNTRY_CODES, default CA). */
export function countryCodes(): string[] {
    return (Deno.env.get("PLAID_COUNTRY_CODES") ?? "CA").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
}

export function webhookUrl(): string {
    return `${Deno.env.get("SUPABASE_URL")}/functions/v1/plaid-webhook`;
}

/** /transactions/refresh is free on the Trial plan but billed per call on paid plans. */
export function refreshEnabled(): boolean {
    return (Deno.env.get("PLAID_REFRESH_ENABLED") ?? "false").toLowerCase() === "true";
}
