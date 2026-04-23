# Dynamic CSV Ingestion Architecture

The application supports uploading bank transactions from multiple institutions, each with its own proprietary CSV export format. To handle this variability without requiring users to manually map columns during upload, we utilize a **Dynamic Schema Detection** system.

## Data Flow Overview

1. **User Uploads CSV** via `Processing.jsx`
2. **Auto-Detection & Normalization** runs locally in the browser using `src/utils/csvParser.js`
3. **Standardized Insertion** to the `bronze.transactions` table in Supabase
4. **AI Processing** via the `process-transactions` Edge Function to classify the standardized data into `silver_transactions`

---

## 1. The Parser Utility (`csvParser.js`)

At the core of the ingestion pipeline is `parseBankCSV(file)`, a two-pass parser built on top of PapaParse.

### First Pass: Header Detection
The system reads only the *first row* of the uploaded CSV to determine the file's structure.
- **Headered Formats (e.g., Chase):** The first row contains column names (like "Transaction Date", "Amount"). The system verifies this by checking that *every cell* in the first row is purely alphabetic text (`isPureText`).
- **Headerless Formats (e.g., TD Bank):** The first row contains raw transaction data (e.g., a date string, numbers). If any cell contains a parseable date or number, the system identifies the file as headerless.

### Second Pass: Parsing and Standardization

#### Path A: Header-based Parsing (Chase, etc.)
If headers are detected, the CSV is parsed into JSON objects where keys are the column names. The system then maps these variant names into our canonical internal schema:
- **Date:** Mapped from `['Transaction Date', 'Date', 'Posting Date', 'Post Date']`
- **Description:** Mapped from `['Description', 'Memo', 'Merchant', 'Name']`
- **Amount:** Mapped from `['Amount', 'Transaction Amount']`

#### Path B: Headerless Mapping (TD Bank)
If no headers are present, the system defaults to a known positional index approach:
- `row[0]` -> Date
- `row[1]` -> Description
- `row[2]` & `row[3]` -> MoneyOut and MoneyIn, which are mathematically unified into a single signed `Amount`.

### Output format
Both paths converge to yield a standardized array of transaction objects:
```json
{
  "Date": "YYYY-MM-DD",
  "Description": "STARBUCKS STORE 1234",
  "Amount": -5.50
}
```

---

## 2. Ingestion Flow (`Processing.jsx`)

When the user uploads a CSV and clicks "Run AI Processing", the `handleRunAiProcessing` function:
1. Calls `parseBankCSV(file)`.
2. Checks for `parseError`. If a format is completely unrecognizable, a `ParseErrorModal` informs the user.
3. Packages the normalized objects into payloads for the `bronze.transactions` table, mapping the unified `{ Date, Description, Amount }` structure into the `raw_data` JSONB column.

---

## 3. The Backend Pipeline (`process-transactions` Edge Function)

Because the frontend handles all the complexity of date normalization, column alias resolution, and debit/credit math, the backend edge function remains incredibly simple.

When invoked, the function:
1. Immediately locks pending rows by setting `status = 'processing'` to prevent race conditions from concurrent invocations.
2. Extracts the `Amount`, `Date`, and `Description` directly from the `raw_data` JSONB.
3. Maintains a legacy fallback to compute `Amount` from `MoneyOut` / `MoneyIn` for older Bronze DB rows.
4. Bundles the clean data and sends it to the Gemini AI context window for categorization.
5. Does a preflight DB check to ensure Bronze rows weren't deleted manually before attempting batch insertion into `silver_transactions`.
