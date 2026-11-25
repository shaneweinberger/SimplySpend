// Connecting, reconnecting and disconnecting a bank. Called by the Connected
// banks card in Settings with the user's session.
//
// POST { action: "create_link_token", plaid_item_id?, allow_additional? }
//   New connection, or update mode (reconnect) when plaid_item_id is given.
//   In production, refuses a second connection unless allow_additional is true:
//   each one permanently uses one of the Trial plan's 10 slots.
// POST { action: "exchange", public_token }
//   Saves the access token FIRST (a lost token is a lost slot), then the accounts.
// POST { action: "reconnected", plaid_item_id }
//   After update mode succeeds: marks the connection OK and syncs it.
// Every action except "remove" requires the user's email in public.plaid_access.
//
// POST { action: "remove", plaid_item_id }
//   Ends Plaid's subscription for it. On the Trial plan this does NOT free a slot.

import { hasPlaidAccess, NO_ACCESS } from "../_shared/access.ts";
import { adminClient, corsHeaders, json, requestUser, runInBackground } from "../_shared/http.ts";
import { countryCodes, newConnectionEnv, plaid, PlaidError, webhookUrl } from "../_shared/plaid.ts";
import { loadItems, saveAccounts, syncItem, type PlaidItemRow } from "../_shared/plaidSync.ts";
import { runProcessing } from "../_shared/processing.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);

    const db = adminClient();
    const user = await requestUser(req, db);
    if (!user) return json({ error: "Sign in first." }, 401);

    // deno-lint-ignore no-explicit-any
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Expected a JSON body." }, 400); }

    // Only accounts in public.plaid_access may connect a bank: each connection
    // permanently uses one of the Trial plan's 10 slots. Disconnecting stays
    // open to everyone, so anyone removed from the list can still end a
    // connection they already made.
    if (body.action !== "remove" && !(await hasPlaidAccess(db, user))) return json(NO_ACCESS, 403);

    const ownItem = async (id: string) => {
        const { data } = await db.from("plaid_items")
            .select("id, user_id, env, item_id, access_token, institution_name, cursor, status")
            .eq("id", id).eq("user_id", user.id).maybeSingle();
        return data as PlaidItemRow | null;
    };

    try {
        switch (body.action) {
            case "create_link_token": {
                const common = {
                    client_name: "SimplySpend",
                    user: { client_user_id: user.id },
                    country_codes: countryCodes(),
                    language: "en",
                    webhook: webhookUrl(),
                    ...(Deno.env.get("PLAID_REDIRECT_URI") ? { redirect_uri: Deno.env.get("PLAID_REDIRECT_URI") } : {}),
                };

                if (body.plaid_item_id) {
                    const item = await ownItem(body.plaid_item_id);
                    if (!item) return json({ error: "Connection not found." }, 404);
                    // Update mode reuses the same Item, so it never uses another slot.
                    const res = await plaid(item.env, "/link/token/create", { ...common, access_token: item.access_token });
                    return json({ link_token: res.link_token, env: item.env, mode: "update" });
                }

                const env = newConnectionEnv();
                if (env === "production" && !body.allow_additional) {
                    const { count } = await db.from("plaid_items")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", user.id).eq("env", "production").neq("status", "removed");
                    if ((count ?? 0) > 0) {
                        return json({
                            error: "ALREADY_CONNECTED",
                            message: "You already have a bank connected. Each new connection permanently uses one of your 10 free Plaid slots, so reconnect the existing one instead.",
                        }, 409);
                    }
                }

                const days = Number(Deno.env.get("PLAID_DAYS_REQUESTED") ?? 90);
                const res = await plaid(env, "/link/token/create", {
                    ...common,
                    products: ["transactions"],
                    transactions: { days_requested: Math.min(Math.max(days, 1), 730) },
                });
                return json({ link_token: res.link_token, env, mode: "create" });
            }

            case "exchange": {
                if (!body.public_token) return json({ error: "public_token is required." }, 400);
                const env = newConnectionEnv();
                const ex = await plaid(env, "/item/public_token/exchange", { public_token: body.public_token });

                // Save before anything else can fail.
                let inserted: PlaidItemRow | null = null;
                for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
                    const { data, error } = await db.from("plaid_items").insert({
                        user_id: user.id,
                        env,
                        item_id: ex.item_id,
                        access_token: ex.access_token,
                        institution_name: body.institution?.name ?? null,
                        institution_id: body.institution?.institution_id ?? null,
                    }).select("id, user_id, env, item_id, access_token, institution_name, cursor, status").single();
                    if (error) console.error(`[plaid-link] saving item ${ex.item_id} failed (attempt ${attempt + 1})`, error);
                    inserted = data as PlaidItemRow | null;
                }
                if (!inserted) {
                    // Not logged: the access token. The item ID lets Plaid support recover it.
                    return json({ error: `Connected, but saving failed. Contact Plaid support with item ID ${ex.item_id}.` }, 500);
                }

                // Prefer the institution name Plaid reports over what the browser sent.
                try {
                    const info = await plaid(env, "/item/get", { access_token: ex.access_token });
                    const institutionId = info.item?.institution_id;
                    let name = info.item?.institution_name ?? null;
                    if (!name && institutionId) {
                        const inst = await plaid(env, "/institutions/get_by_id", { institution_id: institutionId, country_codes: countryCodes() });
                        name = inst.institution?.name ?? null;
                    }
                    if (name || institutionId) {
                        await db.from("plaid_items").update({
                            institution_name: name ?? inserted.institution_name,
                            institution_id: institutionId ?? null,
                        }).eq("id", inserted.id);
                        inserted.institution_name = name ?? inserted.institution_name;
                    }
                } catch (err) {
                    console.warn("[plaid-link] institution lookup failed", err);
                }

                await saveAccounts(db, inserted);
                const { data: accounts } = await db.from("plaid_accounts").select("*").eq("plaid_item_id", inserted.id);
                return json({ plaid_item_id: inserted.id, env, accounts });
            }

            case "reconnected": {
                const item = await ownItem(body.plaid_item_id);
                if (!item) return json({ error: "Connection not found." }, 404);
                await db.from("plaid_items").update({ status: "ok", error_code: null }).eq("id", item.id);
                const [fresh] = await loadItems(db, { itemId: item.id });
                const summary = fresh ? await syncItem(db, fresh) : null;
                if (summary && summary.inserted + summary.resurrected > 0) runInBackground(runProcessing());
                return json({ ok: true, summary });
            }

            case "remove": {
                const item = await ownItem(body.plaid_item_id);
                if (!item) return json({ error: "Connection not found." }, 404);
                if (item.status !== "removed") {
                    try {
                        await plaid(item.env, "/item/remove", { access_token: item.access_token });
                    } catch (err) {
                        // Already gone at Plaid is fine; anything else, keep it so you can retry.
                        if (!(err instanceof PlaidError && err.code === "ITEM_NOT_FOUND")) throw err;
                    }
                    await db.from("plaid_items").update({ status: "removed" }).eq("id", item.id);
                }
                // Transactions already imported stay in SimplySpend.
                return json({ ok: true });
            }

            default:
                return json({ error: `Unknown action '${body.action}'.` }, 400);
        }
    } catch (err) {
        console.error("[plaid-link] failed", err);
        if (err instanceof PlaidError) return json({ error: err.code, message: err.message }, 502);
        return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
});
