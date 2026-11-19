// TD EasyWeb → Finsight sync.
//
//   npm run sync-td                 download, import, categorise
//   npm run sync-td -- --dry-run    download and check duplicates; import nothing
//   npm run sync-td -- --since 2026-01-01
//   npm run sync-td -- --account "TD Debit"
//   npm run sync-td -- --keep-files keep the downloaded CSVs
//
// See implementation-plans/td-easyweb-sync.md and scripts/td-sync/README.md.

import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';

import { loadConfig } from './config.mjs';
import { createDb, assertAccountsExist, latestBronzeDate, insertBronze, runProcessing } from './db.mjs';
import { syncStart, todayYmd } from './dates.mjs';
import { launchBrowser, EASYWEB_URL, FINSIGHT_HOME } from './browser.mjs';
import { configurePage, waitForLogin, downloadChequing, downloadVisa, manualDownloads, logout } from './easyweb.mjs';
import { ingestAccount } from './ingest.mjs';

const { values: args } = parseArgs({
    options: {
        'dry-run': { type: 'boolean', default: false },
        since: { type: 'string' },
        account: { type: 'string' },
        'keep-files': { type: 'boolean', default: false },
        'no-open': { type: 'boolean', default: false },
    },
});

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** First line of a Playwright error plus which element it was waiting for. */
function describeError(err) {
    const msg = String(err?.message ?? err);
    const first = msg.split('\n')[0];
    const target = msg.match(/waiting for (.+)/);
    return target ? `${first} (waiting for ${target[1].trim()})` : first;
}

async function main() {
    const dryRun = args['dry-run'];
    if (args.since && !/^\d{4}-\d{2}-\d{2}$/.test(args.since)) throw new Error('--since must be YYYY-MM-DD');

    const config = loadConfig();
    const db = createDb(config);
    const accounts = config.accounts.filter((a) => !args.account || a.finsight === args.account);
    if (accounts.length === 0) throw new Error(`No account named "${args.account}" in accounts.json`);
    await assertAccountsExist(db, config.userId, accounts.map((a) => a.finsight));

    // ── 1. Work out what to download ────────────────────────────────────────
    const today = todayYmd();
    console.log(`\nFinsight · TD sync${dryRun ? ' (dry run: nothing will be imported)' : ''}\n`);
    for (const a of accounts) {
        a.latest = await latestBronzeDate(db, config.userId, a.finsight);
        a.from = syncStart({ latest: a.latest, since: args.since, today });
        a.to = today;
        a.slug = a.finsight.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        console.log(`  ${a.finsight.padEnd(16)} ${a.from} → ${a.to}   (latest in Finsight: ${a.latest ?? 'none'})`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const saveDir = join(FINSIGHT_HOME, 'sync', stamp);
    mkdirSync(saveDir, { recursive: true });

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => rl.question(q);

    // ── 2. Download from EasyWeb ────────────────────────────────────────────
    const context = await launchBrowser();
    const page = context.pages()[0] ?? (await context.newPage());
    configurePage(page);
    try {
        await page.goto(EASYWEB_URL);
        console.log('\nLog in to EasyWeb in the Chrome window that just opened.');
        console.log('(The script waits on My Accounts and never touches the login page.)\n');
        await waitForLogin(page);
        console.log('Logged in. Downloading…\n');

        for (const a of accounts) {
            console.log(`  ${a.finsight}`);
            // `files` / `periods` are filled in as the steps succeed, so anything
            // downloaded before a failure is kept, and the manual fallback only
            // asks for what's still missing.
            const progress = { files: [], periods: [], donePeriods: [] };
            const opts = { easywebName: a.easyweb, from: a.from, to: a.to, saveDir, slug: a.slug, progress };
            try {
                if (a.kind === 'visa') await downloadVisa(page, opts);
                else await downloadChequing(page, opts);
                console.log(`    ✓ ${plural(progress.files.length, 'file')} downloaded`);
            } catch (err) {
                console.log(`    ✗ Couldn't do this automatically: ${describeError(err)}`);
                if (progress.files.length) console.log(`    (keeping the ${plural(progress.files.length, 'file')} already downloaded)`);
                console.log(`    In the Chrome window, please download ${a.easyweb} as CSV`);
                if (a.kind !== 'visa') {
                    console.log(`    for ${a.from} → ${a.to} (any wider range is fine).`);
                } else {
                    const remaining = progress.periods.filter((p) => !progress.donePeriods.includes(p));
                    if (remaining.length) remaining.forEach((p) => console.log(`      • ${p}`));
                    else console.log(`    for every statement period covering ${a.from} → ${a.to}.`);
                }
                progress.files.push(...await manualDownloads(context, ask, { saveDir, slug: a.slug }));
            }
            a.files = progress.files;
        }
    } finally {
        await logout(page)
            .then(() => console.log('\nSigned out of EasyWeb.'))
            .catch(() => console.log('\n⚠ Couldn\'t sign out automatically — the window will close, but sign out if it\'s still open.'));
        await context.close().catch(() => {});
    }

    // ── 3. Import ───────────────────────────────────────────────────────────
    console.log('');
    let totalNew = 0;
    for (const a of accounts) {
        const result = await ingestAccount({
            files: a.files ?? [],
            account: a.finsight,
            userId: config.userId,
            db,
            fileId: randomUUID(),
            fileName: `EasyWeb sync ${today}`,
            dryRun,
            insert: (rows) => insertBronze(db, rows),
        });
        totalNew += result.newRows.length;
        for (const f of result.files) {
            console.log(f.error
                ? `  ${a.finsight}: ✗ ${f.file}: ${f.error}`
                : `  ${a.finsight}: ${f.file}: ${f.rows} rows · ${f.duplicates} already in Finsight · ${f.new} new` + (f.blank ? ` · ${f.blank} blank` : ''));
        }
        if (dryRun) {
            for (const r of result.newRows) console.log(`      would add  ${r.Date}  ${String(r.Amount).padStart(10)}  ${r.Description}`);
        }
    }

    // ── 4. Categorise ───────────────────────────────────────────────────────
    if (dryRun) {
        console.log(`\nDry run: ${plural(totalNew, 'transaction')} would be added. Nothing was imported.`);
    } else if (totalNew === 0) {
        console.log('\nNothing new: you\'re up to date.');
    } else {
        console.log(`\nImported ${plural(totalNew, 'transaction')}. AI categorising…`);
        const { processed, limit } = await runProcessing(config);
        if (limit) {
            console.log(`⚠ Token limit reached (${limit.tokensUsed}/${limit.tokenLimit} this ${limit.period}).`);
            console.log(`  The rest stay pending and will be categorised after ${limit.resetAt}.`);
        } else {
            console.log(`✓ ${plural(processed, 'transaction')} categorised.`);
        }
    }

    if (!args['keep-files']) rmSync(saveDir, { recursive: true, force: true });
    else console.log(`\nCSVs kept in ${saveDir}`);

    rl.close();
    if (!dryRun && totalNew > 0 && config.dashboardUrl && !args['no-open']) {
        execFile('open', [config.dashboardUrl]);
    }
    console.log('');
}

main().catch((err) => {
    console.error(`\nSync failed: ${err.message}\n`);
    process.exit(1);
});
