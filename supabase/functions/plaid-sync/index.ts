// Pulls new transactions for connected banks into bronze, then categorizes them.
//
// Two callers:
//   - The schedule (pg_cron, every 4 hours): header x-cron-secret = PLAID_CRON_SECRET.
//     Syncs every connection, asking Plaid to refresh first when
//     PLAID_REFRESH_ENABLED=true (free on the Trial plan).
//   - Sync now in Settings: the user's session. Syncs that user's connections.
//
// POST { plaid_item_id?, refresh? }
//
// verify_jwt is off for this function (the schedule doesn't send a JWT); it
// checks the cron secret or the user's session itself.

import { hasPlaidAccess, NO_ACCESS } from "../_shared/access.ts";
import { adminClient, corsHeaders, json, requestUser, runInBackground, safeEqual } from "../_shared/http.ts";
import { hasCredentials } from "../_shared/plaid.ts";
import { loadItems, syncItem } from "../_shared/plaidSync.ts";
import { runProcessing } from "../_shared/processing.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);

    const db = adminClient();
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }

    const cronSecret = Deno.env.get("PLAID_CRON_SECRET");
    const sentSecret = req.headers.get("x-cron-secret");
    const fromSchedule = Boolean(cronSecret && sentSecret && safeEqual(sentSecret, cronSecret));

    let userId: string | undefined;
    if (!fromSchedule) {
        const user = await requestUser(req, db);
        if (!user) return json({ error: "Sign in first." }, 401);
        // Sync now is limited to accounts in public.plaid_access. The schedule
        // (above) keeps syncing every existing connection regardless.
        if (!(await hasPlaidAccess(db, user))) return json(NO_ACCESS, 403);
        userId = user.id;
    }

    try {
        const items = (await loadItems(db, { userId, itemId: body.plaid_item_id }))
            .filter((item) => hasCredentials(item.env));

        const summaries = [];
        for (const item of items) {
            summaries.push(await syncItem(db, item, {
                refresh: fromSchedule || body.refresh === true,
                trigger: fromSchedule ? "schedule" : "manual",
            }));
        }

        const newRows = summaries.reduce((n, s) => n + s.inserted + s.resurrected, 0);
        // Categorizing can take a while (Gemini), so it runs after the response.
        if (newRows > 0) runInBackground(runProcessing());

        return json({ synced: summaries.length, new_transactions: newRows, categorizing: newRows > 0, summaries });
    } catch (err) {
        console.error("[plaid-sync] failed", err);
        return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
});
