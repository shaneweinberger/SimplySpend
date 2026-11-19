// Receives Plaid webhooks. Every request must carry a valid Plaid signature.
//
// TRANSACTIONS / SYNC_UPDATES_AVAILABLE  → sync that connection, then categorize
// ITEM / ERROR, PENDING_EXPIRATION, PENDING_DISCONNECT → mark it "Reconnect needed"
// ITEM / LOGIN_REPAIRED                  → mark it OK again and sync
// ITEM / USER_PERMISSION_REVOKED, USER_ACCOUNT_REVOKED → mark it disconnected
// Anything else                          → logged and acknowledged
//
// Plaid gets its 200 straight away; the sync runs in the background.
// verify_jwt is off for this function: Plaid can't send a Supabase JWT.

import { adminClient, json, runInBackground } from "../_shared/http.ts";
import { REAUTH_CODES } from "../_shared/plaid.ts";
import { loadItems, syncItem } from "../_shared/plaidSync.ts";
import { runProcessing } from "../_shared/processing.ts";
import { verifyPlaidWebhook } from "../_shared/webhookVerify.ts";

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);

    const rawBody = await req.text();
    // deno-lint-ignore no-explicit-any
    let event: any;
    try { event = JSON.parse(rawBody); } catch { return json({ error: "Bad JSON." }, 400); }

    const db = adminClient();
    const { data: item } = await db.from("plaid_items")
        .select("id, env, status").eq("item_id", event.item_id ?? "").maybeSingle();
    if (!item) {
        console.warn(`[plaid-webhook] unknown item ${event.item_id} (${event.webhook_type}/${event.webhook_code})`);
        return json({ ok: true }); // not ours (or already gone): acknowledge so Plaid stops retrying
    }

    try {
        await verifyPlaidWebhook(item.env, req.headers.get("Plaid-Verification"), rawBody);
    } catch (err) {
        console.warn("[plaid-webhook] rejected", err instanceof Error ? err.message : err);
        return json({ error: "Invalid signature." }, 401);
    }

    const kind = `${event.webhook_type}/${event.webhook_code}`;
    console.log(`[plaid-webhook] ${kind} for ${item.id}`);

    const syncAndProcess = async () => {
        const [fresh] = await loadItems(db, { itemId: item.id });
        if (!fresh) return;
        const summary = await syncItem(db, fresh);
        if (summary.inserted + summary.resurrected > 0) await runProcessing();
    };

    switch (kind) {
        case "TRANSACTIONS/SYNC_UPDATES_AVAILABLE":
            runInBackground(syncAndProcess());
            break;

        case "ITEM/ERROR": {
            const code = event.error?.error_code ?? "ITEM_ERROR";
            await db.from("plaid_items").update({
                status: REAUTH_CODES.has(code) ? "needs_reauth" : "error",
                error_code: code,
            }).eq("id", item.id);
            break;
        }

        case "ITEM/PENDING_EXPIRATION":
        case "ITEM/PENDING_DISCONNECT":
            await db.from("plaid_items").update({ status: "needs_reauth", error_code: event.webhook_code }).eq("id", item.id);
            break;

        case "ITEM/LOGIN_REPAIRED":
            await db.from("plaid_items").update({ status: "ok", error_code: null }).eq("id", item.id);
            runInBackground(syncAndProcess());
            break;

        case "ITEM/USER_PERMISSION_REVOKED":
        case "ITEM/USER_ACCOUNT_REVOKED":
            await db.from("plaid_items").update({ status: "error", error_code: event.webhook_code }).eq("id", item.id);
            break;

        default:
            break; // e.g. INITIAL_UPDATE / HISTORICAL_UPDATE: superseded by SYNC_UPDATES_AVAILABLE
    }

    return json({ ok: true });
});
