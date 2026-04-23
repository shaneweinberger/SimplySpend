import Papa from 'papaparse';

// ─── Known Header Aliases ─────────────────────────────────────────────────────
// Maps common bank CSV column names to our three standardized fields.
// All aliases are lowercase for case-insensitive matching.
const DATE_ALIASES    = ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'txn date'];
const DESC_ALIASES    = ['description', 'name', 'payee', 'merchant', 'memo', 'transaction description'];
const AMOUNT_ALIASES  = ['amount', 'transaction amount', 'value', 'debit/credit'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to parse a value as a calendar date.
 * Returns true if the value looks like a date string (not a plain number).
 */
function looksLikeDate(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    const str = String(value).trim();
    // Reject if the string is purely numeric (e.g. "12345") — that's an amount, not a date
    if (/^\d+(\.\d+)?$/.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
}

/**
 * Attempt to parse a value as a numeric amount.
 * Strips currency symbols and whitespace, returns a finite number or NaN.
 */
function parseAmount(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 0;
    const clean = String(value).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(clean);
    return isFinite(num) ? num : 0;
}

/**
 * Normalize a date value to YYYY-MM-DD format.
 * Falls back to today's date if parsing fails.
 */
function normalizeDate(value) {
    const d = new Date(String(value).trim());
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

/**
 * Search a list of header strings for one that matches any of the provided aliases.
 * Returns the original header string, or null if no match found.
 */
function findHeader(headers, aliases) {
    const lowerHeaders = headers.map(h => String(h).trim().toLowerCase());
    for (const alias of aliases) {
        const idx = lowerHeaders.indexOf(alias);
        if (idx !== -1) return headers[idx];
    }
    return null;
}

// ─── Core Detection ───────────────────────────────────────────────────────────

/**
 * Returns true if a cell value is purely text — only letters, spaces, and
 * light punctuation (slashes, hyphens, etc.). No digits at all.
 * Empty/blank cells are treated as non-text (they can't confirm a header).
 */
function isPureText(value) {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    if (str === '') return false;
    // Must contain at least one letter and NO digits
    return /^[a-zA-Z][a-zA-Z\s/\-_.,()]*$/.test(str);
}

/**
 * Determines whether the first row of CSV data contains headers or raw data.
 *
 * Heuristic: If EVERY cell in the first row is purely text (no numbers, no
 * dates, no amounts), the row is treated as a header (e.g. Chase).
 * If any cell contains a number or looks like a date, the row is raw data
 * (e.g. TD Bank's headerless format).
 */
function hasHeaders(firstRow) {
    if (!firstRow || firstRow.length === 0) return false;
    // Every non-empty cell must be purely alphabetic text for this to be a header row
    return firstRow.every(cell => isPureText(cell));
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse a HEADER-BASED CSV (e.g. Chase).
 * Uses alias matching to locate Date, Description, and Amount columns.
 *
 * @param {Object[]} rows – Array of objects keyed by header name.
 * @returns {{ transactions: Array, error: string|null }}
 */
function parseWithHeaders(rows) {
    if (rows.length === 0) return { transactions: [], error: 'CSV file is empty.' };

    const headers = Object.keys(rows[0]);
    const dateCol   = findHeader(headers, DATE_ALIASES);
    const descCol   = findHeader(headers, DESC_ALIASES);
    const amountCol = findHeader(headers, AMOUNT_ALIASES);

    // All three columns are required
    if (!dateCol || !descCol || !amountCol) {
        const missing = [];
        if (!dateCol)   missing.push('Date');
        if (!descCol)   missing.push('Description');
        if (!amountCol) missing.push('Amount');
        return {
            transactions: [],
            error: `Unable to detect the following column(s) in your CSV: ${missing.join(', ')}. Please submit feedback so we can add support for your bank's format.`
        };
    }

    const transactions = rows.map(row => ({
        Date:        normalizeDate(row[dateCol]),
        Description: String(row[descCol] || '').trim(),
        Amount:      parseAmount(row[amountCol]),
    }));

    return { transactions, error: null };
}

/**
 * Parse a HEADERLESS CSV (e.g. TD Bank).
 * Assumes a fixed column layout:
 *   Index 0 = Date
 *   Index 1 = Description
 *   Index 2 = Money Out (withdrawal, will become negative)
 *   Index 3 = Money In  (deposit, will stay positive)
 *   Index 4 = Balance   (ignored)
 *
 * @param {Array[]} rows – Array of arrays (no header row).
 * @returns {{ transactions: Array, error: string|null }}
 */
function parseWithoutHeaders(rows) {
    if (rows.length === 0) return { transactions: [], error: 'CSV file is empty.' };

    const transactions = rows.map(row => {
        const moneyOut = parseAmount(row[2]);
        const moneyIn  = parseAmount(row[3]);

        let amount = 0;
        if (moneyOut !== 0) {
            amount = -1 * Math.abs(moneyOut);
        } else if (moneyIn !== 0) {
            amount = Math.abs(moneyIn);
        }

        return {
            Date:        normalizeDate(row[0]),
            Description: String(row[1] || '').trim(),
            Amount:      amount,
        };
    });

    return { transactions, error: null };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a bank CSV file into a standardized array of transaction objects.
 *
 * Automatically detects whether the file has headers (e.g. Chase) or not
 * (e.g. TD Bank) and applies the appropriate parsing strategy.
 *
 * @param {File} file – The CSV File object from a file input.
 * @returns {Promise<{ transactions: Array<{Date: string, Description: string, Amount: number}>, error: string|null }>}
 */
export function parseBankCSV(file) {
    return new Promise((resolve) => {
        // Step 1: Quick peek at the first row to decide the parsing strategy
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            preview: 1, // Read only the first row
            complete: (preview) => {
                const firstRow = preview.data[0];
                const useHeaders = hasHeaders(firstRow);

                // Step 2: Full parse with the determined strategy
                Papa.parse(file, {
                    header: useHeaders,
                    skipEmptyLines: true,
                    complete: (results) => {
                        let parsed;
                        if (useHeaders) {
                            parsed = parseWithHeaders(results.data);
                        } else {
                            parsed = parseWithoutHeaders(results.data);
                        }
                        resolve(parsed);
                    },
                    error: (err) => {
                        resolve({ transactions: [], error: `CSV parsing error: ${err.message}` });
                    }
                });
            },
            error: (err) => {
                resolve({ transactions: [], error: `CSV parsing error: ${err.message}` });
            }
        });
    });
}
