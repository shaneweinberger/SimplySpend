// Runs process-transactions until nothing is pending: the same loop as
// processTransactionsInternal in Processing.jsx and runProcessing in
// scripts/td-sync/db.mjs. Your rules and categories apply exactly as they do
// for a CSV upload.

export async function runProcessing({ maxLoops = 10 } = {}): Promise<{ processed: number; tokenLimit: boolean }> {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-transactions`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let processed = 0;

    for (let i = 0; i < maxLoops; i++) {
        const res = await fetch(url, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: "{}",
        });
        const text = await res.text();
        // deno-lint-ignore no-explicit-any
        let body: any = null;
        try { body = JSON.parse(text); } catch { /* non-JSON error page */ }

        // Over the token limit: the rows stay pending and the next sync picks them up.
        if (res.status === 429 && body?.error === "TOKEN_LIMIT_EXCEEDED") return { processed, tokenLimit: true };
        if (!res.ok) throw new Error(`process-transactions failed (${res.status}): ${body?.error || text.slice(0, 200)}`);
        if (!Array.isArray(body)) break; // "No pending transactions found."

        // deno-lint-ignore no-explicit-any
        const n = body.reduce((sum: number, r: any) => sum + (r.processedCount || 0), 0);
        processed += n;
        if (n === 0) break;
    }
    return { processed, tokenLimit: false };
}
