// CSV file → parsed rows → duplicate check → bronze rows.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseBankCSV } from '../../src/utils/csvParser.js';
import { deduplicateTransactions, filterDuplicates } from '../../src/utils/deduplicateTransactions.js';

/**
 * Prepares one account's downloaded CSVs for bronze.
 *
 * Files are checked one after another. In a real run, `insert` is called per
 * file, so a later file (e.g. the previous Visa cycle) is checked against rows
 * the earlier file just added. In a dry run nothing is inserted, so those rows
 * are tracked in memory to give the same answer.
 *
 * @returns {Promise<{ files: Array<object>, inserted: number, newRows: Array<object> }>}
 */
export async function ingestAccount({ files, account, userId, db, fileId, fileName, dryRun, insert }) {
    const results = [];
    const allNew = [];
    for (const file of files) {
        const { transactions, error, skippedCount = 0 } = await parseBankCSV(readFileSync(file, 'utf8'));
        if (error) {
            results.push({ file: basename(file), error });
            continue;
        }

        let { newRows, duplicateCount } = await deduplicateTransactions(transactions, userId, account, db);
        if (dryRun && allNew.length) {
            const again = filterDuplicates(newRows, allNew);
            duplicateCount += again.duplicateCount;
            newRows = again.newRows;
        }

        if (!dryRun && newRows.length) {
            await insert(newRows.map((row) => ({
                user_id: userId,
                file_id: fileId,
                file_name: fileName,
                transaction_account: account,
                raw_data: row, // { Date, Description, Amount }, same as CSV uploads
                status: 'pending',
            })));
        }

        allNew.push(...newRows);
        results.push({
            file: basename(file),
            rows: transactions.length,
            blank: skippedCount,
            duplicates: duplicateCount,
            new: newRows.length,
        });
    }
    return { files: results, inserted: dryRun ? 0 : allNew.length, newRows: allNew };
}
