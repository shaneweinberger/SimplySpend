import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/** Service-role client: bypasses RLS. Only ever used server-side. */
export function adminClient(): SupabaseClient {
    return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/** The signed-in user making this request, or null. */
export async function requestUser(req: Request, admin: SupabaseClient): Promise<User | null> {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
    const x = new TextEncoder().encode(a);
    const y = new TextEncoder().encode(b);
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

/**
 * Keeps work running after the response is sent (Supabase Edge Runtime), so
 * Plaid's webhook gets a fast 200 and the dashboard isn't kept waiting on Gemini.
 */
export function runInBackground(promise: Promise<unknown>): void {
    const guarded = promise.catch((err) => console.error("[background] failed", err));
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(guarded);
}
