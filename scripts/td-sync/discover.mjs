// Phase 0 of implementation-plans/td-easyweb-sync.md: the EasyWeb discovery run.
//
//   npm run td-discover
//
// Opens EasyWeb in Chrome. You log in and download each account's CSV the way
// you normally would; this records which buttons you clicked (not what you
// typed) so the sync can repeat those steps. Afterwards it checks that every
// downloaded CSV parses with the app's own parser.
//
// Output stays on this machine: ~/.finsight/discovery/<timestamp>/
//   events.jsonl  — clicks, page loads, downloads
//   downloads/    — the CSVs you downloaded
//   summary.json  — parse results per CSV

import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { launchBrowser, EASYWEB_URL, FINSIGHT_HOME } from './browser.mjs';
import { attachRecorder } from './recorder.mjs';
import { parseBankCSV } from '../../src/utils/csvParser.js';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(FINSIGHT_HOME, 'discovery', stamp);

async function summarize(file) {
    const { transactions, error, skippedCount } = await parseBankCSV(readFileSync(file, 'utf8'));
    const dates = transactions.map((t) => t.Date).sort();
    return {
        file: basename(file),
        error,
        rows: transactions.length,
        skippedCount,
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
        sample: transactions.slice(0, 2),
    };
}

async function main() {
    console.log('\nFinsight · EasyWeb discovery run\n');
    const context = await launchBrowser();
    const recorder = await attachRecorder(context, outDir);

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(EASYWEB_URL);

    console.log('A Chrome window has opened on EasyWeb. In that window:\n');
    console.log('  1. Log in as you normally do (nothing you type is recorded).');
    console.log('  2. Open TD STUDENT CHEQUING ACCOUNT → download its transactions as CSV');
    console.log('     for any date range. Use the same steps you would normally use.');
    console.log('  3. Go back and do the same for TD CASH BACK VISA* CARD.');
    console.log('  4. (Optional) Download the chequing CSV once more with the same dates.');
    console.log('  5. Sign out of EasyWeb.\n');
    console.log('Then come back here and press Enter.\n');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const closed = new Promise((resolve) => context.on('close', resolve));
    await Promise.race([rl.question('Press Enter when you are done… '), closed]);
    rl.close();

    await recorder.settled();
    await context.close().catch(() => {});

    const csvs = recorder.downloads.filter((f) => f.toLowerCase().endsWith('.csv'));
    const results = [];
    for (const f of csvs) results.push(await summarize(f));
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 2));

    console.log(`\nRecorded ${recorder.eventCount()} events, ${recorder.downloads.length} download(s).\n`);
    for (const r of results) {
        const status = r.error ? `✗ ${r.error}` : `✓ ${r.rows} transactions, ${r.from} → ${r.to}` + (r.skippedCount ? `, ${r.skippedCount} blank rows skipped` : '');
        console.log(`  ${r.file}: ${status}`);
    }
    if (csvs.length === 0) console.log('  No CSVs were downloaded.');
    console.log(`\nEverything was saved locally to:\n  ${outDir}\n`);
    console.log('Tell Claude that folder path to continue.\n');
}

main().catch((err) => {
    console.error('\nDiscovery run failed:', err.message);
    process.exit(1);
});
