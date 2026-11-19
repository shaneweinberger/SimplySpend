// Shared browser setup for the TD EasyWeb scripts.
//
// Uses your installed Google Chrome (channel: 'chrome') with a dedicated,
// persistent profile so EasyWeb can remember the device between runs.
// The profile holds TD session cookies, so it lives OUTSIDE the repo.
//
// Deliberately no stealth / anti-detection flags: you log in yourself, and if
// TD ever challenges the automated browser, we stop rather than work around it.

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export const FINSIGHT_HOME = join(homedir(), '.finsight');
export const PROFILE_DIR = join(FINSIGHT_HOME, 'td-profile');
export const EASYWEB_URL = 'https://easyweb.td.com/';

export async function launchBrowser({ profileDir = PROFILE_DIR, headless = false } = {}) {
    mkdirSync(profileDir, { recursive: true });
    return chromium.launchPersistentContext(profileDir, {
        channel: 'chrome',
        headless,
        viewport: null,       // use the real window size
        acceptDownloads: true,
    });
}

/** Drops query strings and fragments, which can carry session tokens. */
export function safeUrl(url) {
    try {
        const u = new URL(url);
        return `${u.origin}${u.pathname}`;
    } catch {
        return String(url).split(/[?#]/)[0];
    }
}
