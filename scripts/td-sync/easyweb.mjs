// EasyWeb automation, based on the Phase 0 findings in README.md.
//
// Rules:
//   - Never touch the login page: you log in yourself.
//   - Every account download can fall back to "do it yourself in the window",
//     so an EasyWeb redesign makes the sync partly manual instead of broken.
//   - If TD shows a challenge or warning, stop. Never try to work around it.

import { join } from 'node:path';
import { parts, selectVisaPeriods } from './dates.mjs';

export const ACCOUNTS_URL = 'https://easyweb.td.com/ui/ew/fs';
const STEP_TIMEOUT = 15_000;
const CSV_OPTION = 'Spreadsheet (.CSV)';
const MONTH_NAME = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactName = (text) => new RegExp(`^\\s*${escapeRe(text)}\\s*$`);

export function configurePage(page) {
    page.setDefaultTimeout(STEP_TIMEOUT);
}

// ── Login ────────────────────────────────────────────────────────────────────

/** Resolves once you're signed in and on My Accounts. */
export async function waitForLogin(page, { timeoutMs = 10 * 60_000 } = {}) {
    await page.waitForURL((u) => u.href.startsWith(ACCOUNTS_URL), { timeout: timeoutMs });
    await page.locator('a.uf-account-name-and-link').first().waitFor({ state: 'visible', timeout: 60_000 });
}

// ── Shared steps ─────────────────────────────────────────────────────────────

async function goToMyAccounts(page) {
    if (page.url().startsWith(ACCOUNTS_URL)) return;
    const nav = page.getByRole('link', { name: exactName('My Accounts') });
    if (await nav.count()) await nav.first().click();
    else await page.goto(ACCOUNTS_URL);
    await page.waitForURL((u) => u.href.startsWith(ACCOUNTS_URL), { timeout: 30_000 });
    await page.locator('a.uf-account-name-and-link').first().waitFor({ state: 'visible' });
}

async function openAccount(page, easywebName) {
    await goToMyAccounts(page);
    await page.locator('a.uf-account-name-and-link').filter({ hasText: easywebName }).first().click();
}

async function selectOption(page, selectId, optionText) {
    await page.locator(`#${selectId}`).click();
    await page.getByRole('option', { name: exactName(optionText) }).first().click();
}

/** The text "Download" button inside an open download panel (not the icon). */
const downloadButton = (page) =>
    page.locator('button.uf-button:visible').filter({ hasText: /^\s*Download\s*$/ }).first();

async function clickAndSave(page, locator, target) {
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60_000 }),
        locator.click(),
    ]);
    await download.saveAs(target);
    return target;
}

async function closePanel(page, id) {
    const btn = page.locator(`#${id}`);
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3_000 }).catch(() => {});
}

// ── Chequing: custom date range ──────────────────────────────────────────────

/** Opens whichever filter chip offers "Custom", and picks it. */
async function chooseCustomRange(page) {
    if (await page.locator('#input-daDtTransFrom').isVisible()) return;
    const chips = page.locator('[class*="uf-dropdown-chip"]:visible');
    const count = await chips.count();
    for (let i = 0; i < Math.min(count, 6); i++) {
        await chips.nth(i).click().catch(() => {});
        const custom = page.getByRole('option', { name: exactName('Custom') });
        if (await custom.first().isVisible().catch(() => false)) {
            await custom.first().click();
            await page.locator('#input-daDtTransFrom').waitFor({ state: 'visible' });
            return;
        }
        await page.keyboard.press('Escape');
    }
    throw new Error('Could not find the date filter with a "Custom" option');
}

/** Picks a date with EasyWeb's calendar (the method recorded in Phase 0). */
async function pickDate(page, inputId, ymd) {
    const { year, monthName, day } = parts(ymd);
    const input = page.locator(`#${inputId}`);
    await input
        .locator('xpath=ancestor::*[.//button[@aria-label="Select a date"]][1]//button[@aria-label="Select a date"]')
        .first()
        .click();

    const dayCell = page.locator(`td[aria-label="${monthName} ${day}, ${year}"]`);
    if (!(await dayCell.isVisible().catch(() => false))) {
        // Switch to the month grid ("October" header button), then find the month.
        await page.locator('tduf-datetime-calendar button').filter({ hasText: MONTH_NAME }).first().click();
        const monthCell = page.locator(`td[aria-label="${monthName} ${year}"]`);
        for (let i = 0; i < 3 && !(await monthCell.isVisible().catch(() => false)); i++) {
            await page.locator('tduf-datetime-calendar button[aria-label*="previous" i]').first().click({ timeout: 3_000 });
        }
        await monthCell.click();
    }
    await dayCell.click();
    return input.inputValue().catch(() => '');
}

export async function downloadChequing(page, { easywebName, from, to, saveDir, slug, progress }) {
    await openAccount(page, easywebName);
    await page.locator('#daTransactionDownloadButton').waitFor({ state: 'visible', timeout: 30_000 });

    await chooseCustomRange(page);
    const fromShown = await pickDate(page, 'input-daDtTransFrom', from);
    const toShown = await pickDate(page, 'input-daDtTransTo', to);
    console.log(`    date filter set: From "${fromShown}"  To "${toShown}"`);
    await page.getByRole('button', { name: exactName('Apply filters') }).click();
    await page.waitForTimeout(2_000); // let the filtered list load

    await page.locator('#daTransactionDownloadButton button').click();
    await selectOption(page, 'matselect-daDownloadPanelFormatDropdown', CSV_OPTION);
    progress.files.push(await clickAndSave(page, downloadButton(page), join(saveDir, `${slug}-1.csv`)));
    await closePanel(page, 'daDownloadPanelCloseBtn');
}

// ── Visa: statement periods ──────────────────────────────────────────────────

/**
 * Reads the open dropdown's options once the list stops growing. The first
 * dry run read only 2 of ~7 periods, which suggests older statements load
 * after the dropdown opens.
 */
async function readOptionsWhenLoaded(page, { settleMs = 1_500, maxMs = 10_000 } = {}) {
    const read = async () => (await page.getByRole('option').allInnerTexts()).map((t) => t.trim().replace(/\s+/g, ' '));
    const deadline = Date.now() + maxMs;
    let texts = await read();
    let changedAt = Date.now();
    while (Date.now() < deadline) {
        await page.waitForTimeout(250);
        const next = await read();
        if (next.length !== texts.length) { texts = next; changedAt = Date.now(); }
        else if (texts.length > 0 && Date.now() - changedAt >= settleMs) break;
    }
    return texts;
}

export async function downloadVisa(page, { easywebName, from, to, saveDir, slug, progress }) {
    await openAccount(page, easywebName);
    const openPanelButton = page.locator('#paymentPlanTransactionDownloadButton button');
    const cycleSelect = page.locator('#matselect-paymentPlanDownloadCycleSelect');
    await openPanelButton.waitFor({ state: 'visible', timeout: 30_000 });

    const ensurePanelOpen = async () => {
        if (await cycleSelect.isVisible().catch(() => false)) return;
        await openPanelButton.click();
        await cycleSelect.waitFor({ state: 'visible' });
    };

    await ensurePanelOpen();
    await cycleSelect.click();
    const texts = await readOptionsWhenLoaded(page);
    await page.keyboard.press('Escape');
    console.log(`    EasyWeb lists ${texts.length} periods: ${texts.join(' | ')}`);

    const { selected, unparsed } = selectVisaPeriods(texts, from, to);
    if (unparsed.length) console.log(`    (ignored unrecognised period options: ${unparsed.join(' | ')})`);
    if (selected.length === 0) throw new Error(`No statement period covers ${from} → ${to}`);
    progress.periods.push(...selected.map((p) => p.text));

    for (const [i, period] of selected.entries()) {
        console.log(`    period ${i + 1}/${selected.length}: ${period.text}`);
        // After a download EasyWeb may leave a toast or close the panel;
        // clear overlays and reopen the panel if needed before the next one.
        if (i > 0) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }
        await ensurePanelOpen();
        await selectOption(page, 'matselect-paymentPlanDownloadCycleSelect', period.text);
        await selectOption(page, 'matselect-ccDownloadPanelFormatDropdown', CSV_OPTION);
        progress.files.push(await clickAndSave(page, downloadButton(page), join(saveDir, `${slug}-${i + 1}.csv`)));
        progress.donePeriods.push(period.text);
        console.log('      ✓ downloaded');
    }
    await closePanel(page, 'ccDownloadPanelCloseBtn');
}

// ── Manual fallback & logout ─────────────────────────────────────────────────

/**
 * Collects every download made in the browser until you press Enter.
 * Used when an automated step can't find what it expects.
 */
export async function manualDownloads(context, ask, { saveDir, slug }) {
    const files = [];
    const saves = [];
    const onDownload = (download) => {
        const target = join(saveDir, `${slug}-manual-${files.length + saves.length + 1}.csv`);
        saves.push(download.saveAs(target).then(() => {
            files.push(target);
            console.log(`    ✓ got ${download.suggestedFilename()}`);
        }));
    };
    const pages = context.pages();
    pages.forEach((p) => p.on('download', onDownload));
    const onPage = (p) => p.on('download', onDownload);
    context.on('page', onPage);

    await ask('    Press Enter here once the download(s) have finished… ');

    await Promise.allSettled(saves);
    pages.forEach((p) => p.off('download', onDownload));
    context.off('page', onPage);
    return files;
}

export async function logout(page) {
    // An open dropdown, panel or backdrop (e.g. left by the manual fallback)
    // sits on top of the nav and swallows the click, so clear them first.
    await page.keyboard.press('Escape').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await closePanel(page, 'daDownloadPanelCloseBtn');
    await closePanel(page, 'ccDownloadPanelCloseBtn');

    const link = page.getByRole('link', { name: exactName('Logout') }).first();
    const before = page.url();
    try {
        await link.click({ timeout: 5_000 });
    } catch {
        // Still covered: click the link element directly.
        await link.evaluate((el) => el.click(), undefined, { timeout: 5_000 });
    }
    // Wait for the sign-out page itself. Closing the browser before it loads
    // can cancel the request and leave the session open.
    await page.waitForURL((u) => u.href !== before, { timeout: 15_000 });
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
}
