// Who may use Plaid: emails listed in public.plaid_access
// (migration 20261126120000_plaid_access.sql). Edit that table to change it.

import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Fails closed: any lookup error means no access. */
export async function hasPlaidAccess(db: SupabaseClient, user: User): Promise<boolean> {
    const email = user.email?.trim().toLowerCase();
    if (!email) return false;
    const { data, error } = await db.from("plaid_access").select("email").eq("email", email).maybeSingle();
    if (error) {
        console.error("[plaid-access] lookup failed; denying", error);
        return false;
    }
    return Boolean(data);
}

export const NO_ACCESS = {
    error: "NO_PLAID_ACCESS",
    message: "Bank sync isn't available on this account.",
};
