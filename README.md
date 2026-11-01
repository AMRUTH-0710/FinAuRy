# Finance Story 📈

Transform any financial file — Excel workbooks, CSV ledgers, JSON exports, PDFs, college club registers, bank statements, and corporate reports — into an intuitive, interactive financial story.

Finance Story uses deterministic arithmetic, multi-row schema inference, Indian financial standards (₹ INR, Lakhs, Crores), and an official regulatory verification architecture (GSTIN, MCA CIN, RBI IFSC) to bring financial clarity to ordinary users and finance teams alike.

---

## Key Capabilities (The Six Pillars)

### 1. Universal File Upload
- **Format Support:** Excel (`.xlsx`, `.xls`), CSV, TSV, JSON, PDF, and plain text exports.
- **Robust Schema Normalization:**
  - Auto-scores first 10 rows to detect actual header lines beneath promotional banners (e.g. `PUPA 2025 - ANNUAL COLLEGE CULTURAL FESTIVAL BILLS RECORD`).
  - Gracefully handles blank rows, merged cells, and irregular column titles (`Vendor Name`, `Item / Purpose`, `Purchaser / Coordinator`, `Bill No`, `Amount (₹)`).
  - Generates sensible sequential fallback dates when date columns are omitted, ensuring **zero silent record drops**.

### 2. Intelligent Data Understanding
- **Archetype Classification:** Automatically identifies the nature of the dataset:
  - `club_expense_register`: College fest bills, student club expenses, coordinator reimbursements.
  - `b2b_saas`: ARR, MRR, Cloud Infrastructure, Client ARR.
  - `enterprise_pnl`: Corporate P&L statements, Gross Profit, Operating Expenses.
  - `ecommerce_gmv`: Merchant settlements, logistics, inventory.
  - `general_ledger`: Universal operating ledgers.
- **Evidence Metadata:** Retains `purchaser`, `payment_status` (`Paid` vs `Pending`), `payment_mode`, `bill_number`, `source_sheet`, and `source_row_index` on every transaction.

### 3. Accurate Calculations & Evidence
- **Deterministic Math:** Totals, balances, category breakdowns, run-rates, and trends are computed via code arithmetic (`sumMinor`, integer paise/cents), never generative AI guesses.
- **Club & Event Register Metrics:**
  - Lead purchaser spend & rankings (e.g., coordinator with highest spend).
  - Pending vs settled reimbursement totals (`reimbursement_pending_minor` vs `reimbursement_paid_minor`).
  - Unsettled voucher counts.
  - Duplicate transaction detection (matching date, amount, description).
  - Largest single expense voucher tracking.
- **Indian Financial Standards:** Full localization using `₹` (INR), Indian lakh/crore numbering conventions (`₹12,50,000.00`), and strict separation of distinct currencies.

### 4. Dynamic Financial Stories
- Real-time binding between uploaded datasets and the interactive Story Player (`loadDataset`).
- Adaptive chapter sequences based on the detected archetype.
- Seamless preview modal showing detected rows, columns, and sample entries before story generation.

### 5. Official Financial Source Verification
Extensible architecture (`pipeline/verification.ts` and `POST /api/verify`) validating financial identifiers against official Indian authorities:
- **GSTN / CBIC:** Validates 15-character GSTIN structure, state jurisdiction mapping (01–37, 97, 99), and Luhn Mod-36 check digits.
- **MCA (Ministry of Corporate Affairs):** Validates 21-character Corporate Identity Numbers (CIN) including listing status (L/U), industry NIC code, incorporation year, state, and company type (PLC, PTC, etc.).
- **RBI (Reserve Bank of India):** Validates 11-character Indian Financial System Codes (IFSC) against primary bank routing directories (SBIN, HDFC, ICIC, KKBK, etc.) and enforces RBI benchmark INR standards.
- **Statutory Disclaimers:** Explicit distinction between uploaded records, calculated metrics, AI interpretations, and externally verified facts with SEBI / ICAI advisory disclaimers.

### 6. Testing & Open-Source Readiness
- Comprehensive regression test suites covering:
  - College club registers (`tests/pupa-bills-register.test.ts`).
  - Regulatory verification (`tests/verification.test.ts`).
  - Indian financial standards (`tests/indian-standards.test.ts`).
  - B2B ingest and UI flows (`tests/b2b-ingest.test.ts`).
- Server-side proxying keeps secrets (`GEMINI_API_KEY`) secure on the backend (`/api/*`).

---

## Project Structure

```
├── contracts/             # Shared TypeScript schemas (transactions, facts, archetypes)
├── pipeline/
│   ├── parse.ts           # Universal CSV, JSON, and text parser with column auto-detect
│   ├── xlsx.ts            # Multi-sheet Excel workbook extractor with header scoring
│   ├── categorise.ts      # Merchant and department categorization with metadata retention
│   ├── compute-facts.ts   # Deterministic financial math, club facts & duplicate detection
│   └── verification.ts    # Official regulatory verification (GSTIN, MCA, RBI)
├── server/
│   ├── index.ts           # HTTP API server (/api/ask, /api/dataset/active, /api/verify)
│   ├── gemini.ts          # Tier 2 Gemini structured ingestion enrichment
│   └── config.ts          # Environment configuration & secret resolution
├── src/
│   ├── App.tsx            # Main React landing UI, dropzone, preview modal & CTA
│   ├── ingest/            # Browser file reader & ingestion orchestrator
│   ├── player/            # Interactive Story Player, Canvas, and Capture Bridge
│   └── ask/               # Deterministic Natural Language query engine
└── tests/                 # Automated Vitest test suites
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm or bun

### Installation
```bash
npm install
```

### Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
Fill in `GEMINI_API_KEY` (optional, for Tier 2 natural language summary enhancements). All core calculations, file parsing, and story chapters work 100% deterministically offline without an API key.

### Development Server
```bash
npm run dev
```
The server will start on port `3000` (or `PORT` specified in your environment).

### Running Tests
```bash
npm test
```
To run specific test suites:
```bash
# Test college club register parsing (simulating PUPA BILLS RECORD)
npx vitest run tests/pupa-bills-register.test.ts

# Test official regulatory verification (GSTIN, CIN, IFSC)
npx vitest run tests/verification.test.ts

# Test Indian financial localization
npx vitest run tests/indian-standards.test.ts
```

### Production Build
```bash
npm run build
npm start
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check and active dataset status |
| `/api/ask` | POST | Ask financial questions in natural language |
| `/api/dataset/active` | POST | Update active in-memory transactions for query execution |
| `/api/verify` | POST | Scan transactions for GSTIN, MCA CIN, and IFSC identifiers |
| `/api/ingest/enrich` | POST | Optional Gemini narrative and categorization enrichment |

---

## License
Apache-2.0
