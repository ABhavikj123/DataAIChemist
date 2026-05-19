# Abacum Data Pilot (FinOps Schema Linter)

Abacum Data Pilot is a high-performance, intelligent data validation and financial modeling application designed for modern Financial Planning & Analysis (FP&A) teams. It solves the "chaos phase" of mid-market client onboarding by acting as a dynamic, client-side data linter that cleans unstructured transaction logs, audits operational guidelines, and runs sandbox financial simulations.

---

## Core Features

### 1. Dynamic Ingestion Ingest Terminal
* **Dynamic File Drag-and-Drop:** Breaks away from rigid database requirements. Drag and drop any variable number ($N$) of raw ledger CSV or spreadsheet files simultaneously.
* **Smart Schema Mapper:** Bridges schema drift anomalies. Instantly maps custom tracking columns (e.g., `Cost`, `Payout`, `Value`) to core financial target inputs using case-insensitive lookup fallbacks.

### 2. High-Performance Financial Ledger
* **Reactive Data Grid Matrix:** Displays raw ingestion tables with smooth rendering performance.
* **Inline Sheet Editing:** Double-click any cell to adjust values or clean formats manually with instant client-side field validation.

### 3. Data Validation Console
* **Automated Data Quality Scoring:** Compiles structural syntax anomalies across datasets and exposes an absolute quality telemetry metric.
* **Deep-Link Error Logs:** Identifies syntax errors (like plain text notes typed inside a JSON column). Clicking an error flags the exact target row in the ledger grid view.

### 4. Custom Data Auditing Controls
* **Custom Guardrails Builder:** Allows finance teams to build active rules (e.g., *"Flag transactions where amount is less than $1000"*).
* **Asynchronous Risk Scanner:** Scans entire row arrays in the background, tagging compliance anomalies and syncing status badges dynamically.

### 5. Sandboxed Scenario Planner
* **Real-Time Simulation Controls:** Visual sliders let users model "What-If" business decisions (Revenue Growth, Opex Cuts) on the fly.
* **Zero-Constant Calculation Engine:** Features a dynamic math pipeline that derives cash runway, profit margins, and burn rates directly from the live dataset metrics and manual user cash reserve inputs.

---

## Architecture & Technical Stack

* **Frontend Framework:** Next.js, TypeScript, Tailwind CSS, shadcn/ui.
* **Client-Side Storage Tier (Hot Performance):** IndexedDB (via a lightweight async wrapper). Replaces limited `localStorage` systems to effortlessly buffer 10,000+ data rows at 60fps with zero main UI thread blocking.
* **Server-Side Storage Tier (Production Persistence):** Supabase / PostgreSQL relational API handling schema validation states and auditing control rules.
* **AI Processing Layer:** Google AI Studio (Gemini) / Groq Cloud API endpoints handling batch structural row corrections and multi-row layout sanitization.