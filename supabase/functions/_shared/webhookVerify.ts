// Verifies the Plaid-Verification header on an incoming webhook.
// https://plaid.com/docs/api/webhooks/webhook-verification/
//
// The header is an ES256 JWT. Its payload carries the SHA-256 of the exact
// request body and an issued-at time; the signing key comes from
// /webhook_verification_key/get. Anything unsigned, re-signed, tampered with or
// older than five minutes is rejected.

import { plaid, type PlaidEnv } from "./plaid.ts";

const MAX_AGE_SECONDS = 5 * 60;
const keyCache = new Map<string, CryptoKey>();

function b64urlToBytes(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function keyFor(env: PlaidEnv, kid: string): Promise<CryptoKey> {
    const cacheKey = `${env}:${kid}`;
    const cached = keyCache.get(cacheKey);
    if (cached) return cached;

    const { key } = await plaid(env, "/webhook_verification_key/get", { key_id: kid });
    if (key.expired_at) throw new Error("Webhook signing key has expired.");
    const imported = await crypto.subtle.importKey(
        "jwk",
        { kty: key.kty, crv: key.crv, x: key.x, y: key.y },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
    );
    keyCache.set(cacheKey, imported);
    return imported;
}

/** Resolves if the webhook is genuine; throws with the reason otherwise. */
export async function verifyPlaidWebhook(env: PlaidEnv, header: string | null, rawBody: string): Promise<void> {
    if (!header) throw new Error("Missing Plaid-Verification header.");
    const parts = header.split(".");
    if (parts.length !== 3) throw new Error("Malformed verification JWT.");
    const [h, p, s] = parts;

    const jwtHeader = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    if (jwtHeader.alg !== "ES256") throw new Error(`Unexpected JWT alg ${jwtHeader.alg}.`);
    if (!jwtHeader.kid) throw new Error("JWT has no key ID.");

    const key = await keyFor(env, jwtHeader.kid);
    const valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        b64urlToBytes(s),
        new TextEncoder().encode(`${h}.${p}`),
    );
    if (!valid) throw new Error("Bad webhook signature.");

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    const age = Date.now() / 1000 - Number(payload.iat);
    if (!Number.isFinite(age) || age > MAX_AGE_SECONDS || age < -60) throw new Error("Webhook is too old.");

    if (payload.request_body_sha256 !== await sha256Hex(rawBody)) throw new Error("Webhook body doesn't match its signature.");
}
