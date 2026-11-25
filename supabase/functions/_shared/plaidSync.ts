// Syncs one Plaid connection into bronze (and keeps silver in step for
// transactions that post or change). Used by plaid-sync (schedule, Sync now),
// plaid-webhook (SYNC_UPDATES_AVAILABLE) and plaid-link (first sync).

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEAD_CODES, plaid, PlaidError, type PlaidEnv, REAUTH_CODES, refreshEnabled } from "./plaid.ts";
import {
    monthlyFileId, monthlyFileName, nextDay, planSync, referencedIds, silverPatch, suggestAccountMapping,
} from "./plaidMapping.js";

export interface PlaidItemRow {
    id: string;
    user_id: string;
    env: PlaidEnv;
    item_id: string;
    access_token: string;
    institution_name: string | null;
    cursor: string | null;
    status: string;
}

export interface SyncSummary {
    plaid_item_id: string;
    ok: boolean;
    inserted: number;
    updated: number;
    removed: number;
    resurrected: number;
    skipped?: { beforeCutover: number; disabled: number; unchanged: number };
    waiting_for_mapping?: string[];
    refreshed?: boolean;
    error_code?: string;
    message?: string;
    at: string;
}

const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

function fail(error: unknown): never {
    throw error instanceof Error ? error : new Error(String(error));
}

// deno-lint-ignore no-explicit-any
type Txn = any;

/** Pulls every page since the saved cursor. Restarts if Plaid's data changes mid-way. */
async function pullAll(item: PlaidItemRow) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const added: Txn[] = [], modified: Txn[] = [], removed: Txn[] = [];
        // deno-lint-ignore no-explicit-any
        let accounts: any[] = [];
        let cursor = item.cursor ?? undefined;
        try {
            while (true) {
                const page = await plaid(item.env, "/transactions/sync", {
                    access_token: item.access_token,
                    ...(cursor ? { cursor } : {}),
                    count: 500,
                    options: { include_original_description: true },
                });
                added.push(...page.added);
                modified.push(...page.modified);
                removed.push(...page.removed);
                if (page.accounts?.length) accounts = page.accounts;
                cursor = page.next_cursor;
                if (!page.has_more) break;
            }
            return { added, modified, removed, accounts, nextCursor: cursor ?? null };
        } catch (err) {
            if (err instanceof PlaidError && err.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") continue;
            throw err;
        }
    }
    throw new Error("Plaid kept changing during sync; will retry next run.");
}

/** Adds accounts Plaid knows about but we don't (e.g. a newly opened card). */
// deno-lint-ignore no-explicit-any
async function recordNewAccounts(db: SupabaseClient, item: PlaidItemRow, plaidAccounts: any[], known: Set<string>) {
    const fresh = plaidAccounts.filter((a) => !known.has(a.account_id));
    if (!fresh.length) return;
    const { data: names } = await db.from("user_accounts").select("account_name").eq("user_id", item.user_id);
    const accountNames = (names ?? []).map((r: { account_name: string }) => r.account_name);
    const rows = fresh.map((a) => ({
        plaid_account_id: a.account_id,
        plaid_item_id: item.id,
        user_id: item.user_id,
        name: a.name,
        official_name: a.official_name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        // A new account appearing later is never mapped automatically: you choose,
        // and sync waits for you, so nothing lands on the wrong account.
        transaction_account: known.size === 0 ? suggestAccountMapping(a, accountNames) : null,
    }));
    const { error } = await db.from("plaid_accounts").upsert(rows, { onConflict: "plaid_account_id", ignoreDuplicates: true });
    if (error) fail(error);
}

export async function saveAccounts(db: SupabaseClient, item: PlaidItemRow) {
    const res = await plaid(item.env, "/accounts/get", { access_token: item.access_token }); // free endpoint
    await recordNewAccounts(db, item, res.accounts, new Set());
}

/**
 * One full sync of one connection. Never throws for Plaid problems: they're
 * recorded on the connection (needs_reauth / error) and returned in the summary.
 */
export async function syncItem(db: SupabaseClient, item: PlaidItemRow, { refresh = false } = {}): Promise<SyncSummary> {
    const at = new Date().toISOString();
    const summary: SyncSummary = { plaid_item_id: item.id, ok: false, inserted: 0, updated: 0, removed: 0, resurrected: 0, at };

    try {
        if (refresh && refreshEnabled()) {
            try {
                await plaid(item.env, "/transactions/refresh", { access_token: item.access_token });
                summary.refreshed = true; // results arrive later via SYNC_UPDATES_AVAILABLE
            } catch (err) {
                console.warn(`[plaid-sync] refresh failed for ${item.id}`, err);
                if (err instanceof PlaidError && (REAUTH_CODES.has(err.code) || DEAD_CODES.has(err.code))) throw err;
            }
        }

        // ── Accounts and mapping ──────────────────────────────────────────────
        const { data: acctRows, error: acctErr } = await db.from("plaid_accounts")
            .select("plaid_account_id, name, mask, transaction_account, cutover_date, enabled")
            .eq("plaid_item_id", item.id);
        if (acctErr) fail(acctErr);

        const waiting = (acctRows ?? []).filter((a) => a.enabled && !a.transaction_account);
        if (waiting.length) {
            summary.waiting_for_mapping = waiting.map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ""}`);
            summary.message = "Choose a SimplySpend account for each bank account to start syncing.";
            await db.from("plaid_items").update({ last_sync_summary: summary }).eq("id", item.id);
            return summary;
        }

        // First sync: default each account's cutover to the day after the latest
        // CSV/EasyWeb row, so Plaid's history doesn't duplicate what's there.
        if (!item.cursor) {
            for (const a of acctRows ?? []) {
                if (a.cutover_date || !a.transaction_account) continue;
                const { data: latest, error } = await db.rpc("latest_non_plaid_bronze_date", {
                    p_user_id: item.user_id, p_account: a.transaction_account,
                });
                if (error) fail(error);
                if (latest) {
                    a.cutover_date = nextDay(latest);
                    await db.from("plaid_accounts").update({ cutover_date: a.cutover_date }).eq("plaid_account_id", a.plaid_account_id);
                }
            }
        }

        // ── Pull and plan ─────────────────────────────────────────────────────
        const pulled = await pullAll(item);
        const known = new Set((acctRows ?? []).map((a) => a.plaid_account_id));
        await recordNewAccounts(db, item, pulled.accounts, known);

        const accounts = new Map((acctRows ?? []).map((a) => [a.plaid_account_id, {
            transaction_account: a.transaction_account, cutover_date: a.cutover_date, enabled: a.enabled,
        }]));
        // Accounts first seen in this pull are unknown to `accounts`, so planSync
        // reports them as unmapped and nothing is applied until you map them.

        const existing = new Map();
        for (const ids of chunks(referencedIds(pulled))) {
            const { data, error } = await db.schema("bronze").from("transactions")
                .select("id, status, raw_data, plaid_transaction_id")
                .eq("user_id", item.user_id)
                .in("plaid_transaction_id", ids);
            if (error) fail(error);
            for (const row of data ?? []) existing.set(row.plaid_transaction_id, row);
        }

        const plan = planSync({ ...pulled, accounts, existing });
        summary.skipped = plan.skipped;

        if (plan.unmapped.length) {
            const { data: names } = await db.from("plaid_accounts").select("name, mask").in("plaid_account_id", plan.unmapped);
            summary.waiting_for_mapping = (names ?? []).map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ""}`);
            summary.message = "A new bank account appeared. Choose a SimplySpend account for it to keep syncing.";
            await db.from("plaid_items").update({ last_sync_summary: summary }).eq("id", item.id);
            return summary; // cursor not advanced: these transactions come back next time
        }

        // ── Apply ─────────────────────────────────────────────────────────────
        // Every step is idempotent, and the cursor is saved last: if anything
        // fails, the next run re-applies the same changes safely.
        const insertRows = await Promise.all(plan.inserts.map(async (ins) => ({
            user_id: item.user_id,
            file_id: await monthlyFileId(item.id, ins.transaction_account, ins.raw_data.Date),
            file_name: monthlyFileName(item.institution_name, ins.raw_data.Date),
            transaction_account: ins.transaction_account,
            raw_data: ins.raw_data,
            status: "pending",
            source: "plaid",
            plaid_transaction_id: ins.plaid_transaction_id,
        })));
        for (const rows of chunks(insertRows)) {
            const { error } = await db.schema("bronze").from("transactions")
                .upsert(rows, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
            if (error) fail(error);
        }
        summary.inserted = insertRows.length;

        if (plan.updates.length) {
            const keptIds = plan.updates.filter((u) => !u.resurrect).map((u) => u.bronze_id);
            // deno-lint-ignore no-explicit-any
            const silverByBronze = new Map<string, any>();
            for (const ids of chunks(keptIds)) {
                const { data, error } = await db.from("silver_transactions")
                    .select("id, bronze_id, amount, transaction_date, is_pending, is_edited, is_split")
                    .in("bronze_id", ids);
                if (error) fail(error);
                for (const row of data ?? []) silverByBronze.set(row.bronze_id, row);
            }

            for (const u of plan.updates) {
                const patch: Record<string, unknown> = { plaid_transaction_id: u.plaid_transaction_id, raw_data: u.raw_data };
                // Brought back after Plaid removed it: categorize again (its silver row was deleted).
                if (u.resurrect) patch.status = "pending";
                const { error } = await db.schema("bronze").from("transactions").update(patch).eq("id", u.bronze_id);
                if (error) fail(error);

                const sPatch = silverPatch(silverByBronze.get(u.bronze_id), u.raw_data);
                if (sPatch) {
                    const { error: sErr } = await db.from("silver_transactions").update(sPatch).eq("bronze_id", u.bronze_id);
                    if (sErr) fail(sErr);
                }
            }
            summary.updated = plan.updates.filter((u) => !u.resurrect).length;
            summary.resurrected = plan.updates.filter((u) => u.resurrect).length;
        }

        if (plan.removals.length) {
            for (const ids of chunks(plan.removals.map((r) => r.bronze_id))) {
                // Split parts go with their original (ON DELETE CASCADE on split_parent_id).
                const { error } = await db.from("silver_transactions").delete().in("bronze_id", ids);
                if (error) fail(error);
            }
            for (const r of plan.removals) {
                const { error } = await db.schema("bronze").from("transactions")
                    .update({ status: "deleted", raw_data: r.raw_data }).eq("id", r.bronze_id);
                if (error) fail(error);
            }
            summary.removed = plan.removals.length;
        }

        summary.ok = true;
        const { error: saveErr } = await db.from("plaid_items").update({
            cursor: pulled.nextCursor,
            last_synced_at: at,
            last_sync_summary: summary,
            status: "ok",
            error_code: null,
        }).eq("id", item.id);
        if (saveErr) fail(saveErr);
        return summary;
    } catch (err) {
        console.error(`[plaid-sync] item ${item.id} failed`, err);
        summary.message = err instanceof Error ? err.message : String(err);
        const update: Record<string, unknown> = { last_sync_summary: summary };
        if (err instanceof PlaidError) {
            summary.error_code = err.code;
            update.error_code = err.code;
            if (REAUTH_CODES.has(err.code)) update.status = "needs_reauth";
            else if (DEAD_CODES.has(err.code)) update.status = "error";
        }
        await db.from("plaid_items").update(update).eq("id", item.id);
        return summary;
    }
}

/** The connections this run should sync. */
export async function loadItems(db: SupabaseClient, filter: { userId?: string; itemId?: string }): Promise<PlaidItemRow[]> {
    let q = db.from("plaid_items")
        .select("id, user_id, env, item_id, access_token, institution_name, cursor, status")
        .in("status", ["ok", "error"]);
    if (filter.userId) q = q.eq("user_id", filter.userId);
    if (filter.itemId) q = q.eq("id", filter.itemId);
    const { data, error } = await q;
    if (error) fail(error);
    return (data ?? []) as PlaidItemRow[];
}
