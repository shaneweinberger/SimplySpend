// Node side of the discovery recorder: wires recorder-page.js into every page
// and frame, logs clicks, page navigations and downloads to events.jsonl, and
// saves downloaded files.

import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeUrl } from './browser.mjs';

const PAGE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'recorder-page.js');

function uniquePath(dir, name) {
    const ext = extname(name);
    const stem = basename(name, ext);
    let candidate = join(dir, name);
    for (let i = 2; existsSync(candidate); i++) candidate = join(dir, `${stem} (${i})${ext}`);
    return candidate;
}

/**
 * @returns {{ downloads: string[], eventCount: () => number, settled: () => Promise<void> }}
 */
export async function attachRecorder(context, outDir, { quiet = false } = {}) {
    const downloadsDir = join(outDir, 'downloads');
    mkdirSync(downloadsDir, { recursive: true });
    const logPath = join(outDir, 'events.jsonl');
    const downloads = [];
    const pendingSaves = [];
    let count = 0;
    const start = Date.now();

    const log = (event) => {
        count++;
        appendFileSync(logPath, JSON.stringify({ t: ((Date.now() - start) / 1000).toFixed(1), ...event }) + '\n');
    };

    await context.exposeBinding('__finsightRecord', (source, event) => {
        log({ page: safeUrl(source.page.url()), frame: safeUrl(source.frame.url()), ...event });
    });
    await context.addInitScript({ path: PAGE_SCRIPT });

    const watch = (page) => {
        page.on('framenavigated', (frame) => {
            log({ kind: 'navigate', mainFrame: frame === page.mainFrame(), url: safeUrl(frame.url()), title: null });
        });
        page.on('load', async () => {
            try { log({ kind: 'loaded', url: safeUrl(page.url()), title: await page.title() }); } catch { /* page closed */ }
        });
        page.on('download', (download) => {
            const save = (async () => {
                const target = uniquePath(downloadsDir, download.suggestedFilename());
                await download.saveAs(target);
                downloads.push(target);
                log({ kind: 'download', page: safeUrl(page.url()), from: safeUrl(download.url()), file: basename(target) });
                if (!quiet) console.log(`  ✓ Saved download: ${basename(target)}`);
            })().catch((err) => log({ kind: 'download-error', message: String(err) }));
            pendingSaves.push(save);
        });
        page.on('popup', (popup) => log({ kind: 'popup', url: safeUrl(popup.url()) }));
    };

    context.pages().forEach(watch);
    context.on('page', watch);

    return {
        downloads,
        logPath,
        eventCount: () => count,
        settled: () => Promise.all(pendingSaves).then(() => {}),
    };
}
