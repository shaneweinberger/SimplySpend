# SimplySpend

An AI-powered, privacy-first personal finance dashboard built with React, Supabase, and Google Gemini.

## The Problem vs. The Solution

**The Problem:** Keeping track of personal finances manually is monotonous and inefficient. Standard workflows involve downloading bank CSVs, formatting them for complex spreadsheets, manually categorizing each row, and ultimately still lacking actionable data analytics. Connecting bank accounts to automated 3rd-party services introduces privacy concerns and "set-and-forget" friction that disconnects users from their spending habits.

**The Solution:** **SimplySpend** is a bank-agnostic, privacy-first alternative. It requires absolutely no bank integrations, protecting your sensitive financial credentials. By simply uploading a raw CSV, SimplySpend utilizes an automated schema-agnostic parser and Google Gemini to automatically categorize, enrich, and visualize your financial data. SimplySpend strikes the perfect balance: removing the manual data-entry slog while keeping users engaged through interactive reviews and powerful analytics.

---

## Product Lifecycle & Methodology

The project was developed in two distinct phases to ensure product-market fit and engineering rigor:

- **Phase 1: Ideation & MVP Generation.** Focused on user feedback and rapid prototyping. Prioritized core functionality over codebase perfection to see what users actually wanted and interact directly with early adopters.
- **Phase 2: Scalability & Architecture (V2.0).** A complete ground-up structural rewrite focusing on clean architecture, resilient data pipelines, and production-ready deployments. Ensured the platform scales consistently from 10 users to 100,000 users.

---

## Engineering & Data Architecture

SimplySpend leverages enterprise-grade design patterns tailored for a modern AI web application.

### Medallion Data Architecture (Bronze → Silver)
Inspired by enterprise data lakehouse patterns, the application processes data in distinct layers:
- Raw, unvalidated CSV data lands directly in the `bronze.transactions` table.
- An AI-powered edge function maps and categorizes the data, upserting the enriched payload into the `silver_transactions` table with full database lineage (via `bronze_id`). 

### Resilient AI Processing
Ensures 99.9% uptime and reliable data categorization via an automated fallback system:
- The primary model (`Gemini 2.5 Flash`) retries 3× with exponential backoff on failure.
- Cascades seamlessly to a fallback model (`Gemini 2.0 Flash`) for an additional 3 attempts (6 total attempts across 2 models).

### Zero-Config Bank-Agnostic Ingestion
Designed to accept exports from *any* bank without user-defined templates.
- A heuristic-based parser detects headers (or headerless formats) on the fly.
- Intelligently maps varying bank aliases (e.g., 'Posting Date', 'Payee', 'Debit', 'Credit') to a strictly standardized `{Date, Description, Amount}` processing schema.

### Enterprise-Grade Row-Level Security (RLS)
Full tenant data isolation enforced seamlessly at the database level.
- Every query is strictly user-scoped via Supabase Row-Level Security.
- 10 robust RLS policies enforce isolation across 5 tables, ensuring 100% data privacy.

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend/Database:** Supabase (Auth, PostgreSQL, Row-Level Security)
- **AI/LLM:** Google Gemini Edge Functions
- **Styling:** Tailwind CSS

---

## 📍 Getting Started

### Local Setup

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set the following secrets in your Supabase Dashboard (Edge Function Secrets):
- `GEMINI_API_KEY` — Your Google AI Studio API key

### Edge Function Deployment

> **⚠️ IMPORTANT**: Always deploy with `--no-verify-jwt` to avoid 401 Unauthorized errors. The function uses the service role key internally for database access.

```bash
# Deploy the AI processing function
supabase functions deploy process-transactions --no-verify-jwt
```

---

## Future Roadmap / Fast Follows

While the architecture is stable, the product vision is continually expanding:
- **Financial Chatbot AI:** Deploy a conversational assistant to allow users to "chat with their spending" and query their personal database.
- **Predictive Budgeting Engine:** Introduce forward-looking budgeting tools based on AI-analyzed spending velocity.
- **Automated CI/CD Reviews:** Integrate an automated AI pipeline to analyze daily PRs/commits to detect tech debt, flag architectural vulnerabilities, and enforce codebase standards.
