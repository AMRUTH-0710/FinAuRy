/**
 * Data contracts for "An app just for me" — a year in money.
 * Single source of truth for Pipeline, Story Planner, UI, and Ask Your Year.
 */

export const CATEGORIES = [
  'rent',
  'bills',
  'groceries',
  'eating out',
  'takeaway',
  'coffee',
  'transport',
  'travel',
  'shopping',
  'subscriptions',
  'health',
  'fun',
  'gifts',
  'fees',
  'savings',
  'transfers',
  'income',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Per Section 6.1: "Discretionary" means everything except rent, bills, fees, savings and transfers (and income).
 */
export const NON_DISCRETIONARY_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  'rent',
  'bills',
  'fees',
  'savings',
  'transfers',
  'income',
]);

export const DISCRETIONARY_CATEGORIES: readonly Category[] = CATEGORIES.filter(
  (c) => !NON_DISCRETIONARY_CATEGORIES.has(c)
);

export function isDiscretionaryCategory(category: Category): boolean {
  return !NON_DISCRETIONARY_CATEGORIES.has(category);
}

export type Direction = 'out' | 'in';

export interface RawSourceRow {
  id: string;
  date: string;
  posted_date: string;
  account: string;
  tran_type: string;
  description: string;
  amount: string;
  currency: string;
  purchaser?: string;
  status?: string;
  payment_status?: string;
  payment_mode?: string;
  bill_no?: string;
  bill_number?: string;
  source_sheet?: string;
  source_file?: string;
  source_row_index?: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  posted_date?: string; // ISO YYYY-MM-DD
  time?: string; // Optional HH:MM (undefined when CSV has no times)
  account?: 'Credit card' | 'Savings' | string;
  tran_type?: string;
  /**
   * Magnitude in minor units (integer paise / cents, always >= 0).
   * Direction ("out" | "in") indicates whether money left or entered the account.
   */
  amount_minor: number;
  currency: 'USD' | string;
  direction: Direction;
  raw_description: string;
  /**
   * Privacy-safe, cleaned display merchant/counterparty name (never contains account numbers,
   * card numbers, references, or unmasked full names of individuals).
   */
  merchant: string;
  merchant_confidence: number;
  category: Category;
  /**
   * Optional human-readable B2B department, cost center, or custom category label
   * discovered from the uploaded dataset (e.g. "Cloud & Infrastructure", "R&D", "Enterprise ARR").
   */
  category_label?: string;
  category_confidence: number;
  is_recurring: boolean;
  is_transfer: boolean;
  is_refund: boolean;
  /**
   * Optional purchaser / member name (e.g. for student club registers, committee expense tracking).
   */
  purchaser?: string;
  /**
   * Optional payment / bill status ("Paid" | "Pending" | "Unpaid" | "Reimbursed").
   */
  payment_status?: string;
  /**
   * Optional payment mode / instrument ("UPI" | "Cash" | "Net Banking" | "Cheque" | "Card").
   */
  payment_mode?: string;
  /**
   * Optional bill / invoice number reference.
   */
  bill_number?: string;
  /**
   * Source origin tracking for auditability and evidence preservation.
   */
  source_sheet?: string;
  source_file?: string;
  source_row_index?: number;
  /**
   * Optional foreign currency metadata parsed from inline description.
   */
  fx?: {
    foreign_amount_minor: number;
    foreign_currency: string;
    rate: number;
  };
  source_row: RawSourceRow;
}

export type BusinessArchetype =
  | 'saas_arr'
  | 'ecommerce_gmv'
  | 'enterprise_pnl'
  | 'agency_services'
  | 'ops_supply_chain'
  | 'club_expense_register'
  | 'cashbook'
  | 'bank_statement'
  | 'sales_ledger'
  | 'general_ledger'
  | 'consumer_personal';

export type ColumnRole =
  | 'date'
  | 'posted_date'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'direction'
  | 'vendor'
  | 'purchaser'
  | 'category'
  | 'description'
  | 'status'
  | 'payment_mode'
  | 'bill_no'
  | 'day_of_week'
  | 'account'
  | 'currency'
  | 'ignored';

export interface InferredColumn {
  index: number;
  header: string;
  role: ColumnRole;
  confidence: number;
  evidence: string;
  sampleValues: string[];
}

export interface InferredDocumentSchema {
  documentType: BusinessArchetype;
  confidence: number;
  columns: InferredColumn[];
  dateColIndex: number;
  amountColIndex: number;
  debitColIndex?: number;
  creditColIndex?: number;
  purchaserColIndex?: number;
  statusColIndex?: number;
  vendorColIndex?: number;
  categoryColIndex?: number;
  descColIndex?: number;
  currency?: string;
  unresolvedFields: string[];
  evidence: string[];
}

export interface BusinessMetadata {
  entity_name: string;
  fiscal_period_label: string;
  archetype: BusinessArchetype;
  archetype_label: string;
  currency_code: string;
  currency_symbol: string;
  milestone_label: string;
  milestone_singular: string;
  outflow_label: string;
  inflow_label: string;
  counterparty_label: string;
  source_files: string[];
  generated_by: 'deterministic' | 'gemini_enriched' | 'managed_agent';
  agent_audit_notes?: string[];
  accounting_framework?: IndianAccountingFramework;
  reconciliation_report?: MultiDocReconciliationReport;
  confidence_report?: DataConfidenceReport;
  audit_findings?: AuditFinding[];
}

export type IndianAccountingFramework =
  | 'personal_informal_ledger'
  | 'personal_cash_basis'
  | 'club_receipts_payments'
  | 'micro_business_as'
  | 'corporate_ind_as_schedule_iii';

export type ReconciliationRuleType =
  | 'cashbook_balance'
  | 'double_entry_debit_credit'
  | 'invoice_line_items'
  | 'gst_tax_invoice'
  | 'budget_vs_actual'
  | 'ledger_vs_bills'
  | 'pipeline_cent_for_cent';

export interface ReconciliationCheck {
  id: string;
  ruleType: ReconciliationRuleType;
  ruleName: string;
  formula: string;
  expectedMinor: number;
  actualMinor: number;
  differenceMinor: number;
  isReconciled: boolean;
  supportingTxnIds: string[];
  sourceFiles?: string[];
  notes?: string;
}

export interface MultiDocReconciliationReport {
  overallStatus: 'RECONCILED' | 'DISCREPANCY_DETECTED';
  checks: ReconciliationCheck[];
  totalDifferenceMinor: number;
  reconciledCount: number;
  discrepancyCount: number;
  summaryMarkdown: string;
}

export type AuditFindingSeverity = 'confirmed_error' | 'potential_anomaly' | 'missing_evidence';

export interface AuditFinding {
  id: string;
  title: string;
  severity: AuditFindingSeverity;
  reason: string;
  explanation: string;
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number;
  sourcePage?: number;
  supportingRecordId?: string;
  expectedAmountMinor?: number;
  actualAmountMinor?: number;
  differenceMinor?: number;
  calculation?: string;
  missingEvidence?: string;
  suggestedNextStep: string;
  evidenceTxnIds: string[];
  regulatoryReference?: string;
}

export interface DataConfidenceAmbiguity {
  field: string;
  issue: string;
  severity: 'warning' | 'info';
  recordId?: string;
  requiresUserClarification: boolean;
}

export interface DataConfidenceReport {
  overallScore: number; // 0 - 100
  inferredFieldCount: number;
  missingValueCount: number;
  ambiguousDatesCount: number;
  duplicateCount: number;
  duplicateTxnIds: string[];
  parsingConfidence: number; // 0.0 - 1.0
  currencyConsistency: boolean;
  primaryCurrency: string;
  ambiguities: DataConfidenceAmbiguity[];
}

export const DEFAULT_B2B_CATEGORY_LABELS: Record<Category, string> = {
  rent: 'Facilities & Real Estate',
  bills: 'Core Utilities & Telecom',
  groceries: 'Workplace & Office Ops',
  'eating out': 'Client & Team Hospitality',
  takeaway: 'Field & On-Demand Catering',
  coffee: 'Daily Team Fuel & Perks',
  transport: 'Logistics & Fleet',
  travel: 'Global Ops & Executive Travel',
  shopping: 'CapEx, Hardware & Equipment',
  subscriptions: 'Cloud & SaaS Stack',
  health: 'Benefits & Workforce Wellness',
  fun: 'Events, Summits & Offsites',
  gifts: 'Client & Partner Gifting',
  fees: 'Payment Processing & Banking Fees',
  savings: 'Treasury & Capital Reserves',
  transfers: 'Intercompany & Internal Transfers',
  income: 'Revenue & Gross Inflows',
};

export function getCategoryDisplayLabel(
  category: string,
  customLabels?: Record<string, string>,
  isB2B = false
): string {
  if (customLabels && customLabels[category]) {
    return customLabels[category]!;
  }
  if (isB2B && category in DEFAULT_B2B_CATEGORY_LABELS) {
    return DEFAULT_B2B_CATEGORY_LABELS[category as Category];
  }
  return category;
}

export interface Day {
  date: string; // ISO YYYY-MM-DD (2025-01-01 .. 2025-12-31)
  weekday: number; // 0 = Monday .. 6 = Sunday
  week_index: number; // 0 .. 52 (column in 53x7 grid)
  discretionary_out_minor: number; // Integer cents of discretionary spending ("out", non-refund, non-transfer)
  all_out_minor: number; // Integer cents of all non-transfer "out" transactions
  in_minor: number; // Integer cents of all non-transfer, non-refund "in" transactions
  txn_ids: string[];
  is_payday: boolean;
}

export type FactUnit =
  | 'usd_cents'
  | 'usd'
  | 'count'
  | 'days'
  | 'percent'
  | 'ratio'
  | 'year'
  | 'date'
  | 'text';

export interface Fact {
  id: string;
  label: string;
  value: number | string;
  unit: FactUnit;
  /**
   * Deterministic pre-formatted display string (e.g. "$2,184", "$572.80", "72", "3.1×", "2025")
   * produced by the pipeline so UI code never performs arithmetic on money.
   */
  formatted: string;
  txn_ids: string[];
  computation: string;
}

/**
 * Deterministic money formatting helper (integer minor units / cents / paise -> display string).
 * Placed in contracts so pipeline, query executor, and tests use identical formatting.
 * Supports Indian numbering standards (Lakhs, Crores, en-IN) when prefix is ₹ or locale is en-IN.
 */
export function formatMoneyMinor(
  amountMinor: number,
  options: { showCents?: boolean; prefix?: string; locale?: string } = {}
): string {
  const absMinor = Math.abs(Math.round(amountMinor));
  const prefix = options.prefix ?? '$';
  const showCents = options.showCents ?? absMinor % 100 !== 0;
  const units = Math.floor(absMinor / 100);
  const minorFraction = absMinor % 100;
  const isIndian = prefix === '₹' || prefix === 'Rs.' || prefix === 'Rs' || options.locale === 'en-IN';
  const locale = options.locale ?? (isIndian ? 'en-IN' : 'en-US');
  const unitsFormatted = units.toLocaleString(locale);
  if (showCents) {
    return `${prefix}${unitsFormatted}.${String(minorFraction).padStart(2, '0')}`;
  }
  return `${prefix}${unitsFormatted}`;
}

/**
 * Indian currency & number formatting helper (minor units / paise -> ₹ display string with Lakhs/Crores).
 */
export function formatIndianMoneyMinor(
  amountMinor: number,
  options: { showPaisa?: boolean; prefix?: string; compact?: boolean } = {}
): string {
  const absMinor = Math.abs(Math.round(amountMinor));
  const prefix = options.prefix ?? '₹';
  const units = absMinor / 100;

  if (options.compact) {
    if (units >= 10_000_000) {
      const cr = units / 10_000_000;
      const formatted = Number(cr.toFixed(cr >= 10 ? 1 : 2)).toString();
      return `${prefix}${formatted} Cr`;
    }
    if (units >= 100_000) {
      const lakh = units / 100_000;
      const formatted = Number(lakh.toFixed(lakh >= 10 ? 1 : 2)).toString();
      return `${prefix}${formatted} L`;
    }
    if (units >= 1_000) {
      const k = units / 1_000;
      const formatted = Number(k.toFixed(1)).toString();
      return `${prefix}${formatted} K`;
    }
  }

  return formatMoneyMinor(amountMinor, {
    showCents: options.showPaisa,
    prefix,
    locale: 'en-IN',
  });
}
