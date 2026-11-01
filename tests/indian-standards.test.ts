import { describe, expect, it } from 'vitest';
import { formatIndianMoneyMinor, formatMoneyMinor } from '../contracts/index.js';
import { ingestFilesDeterministically } from '../pipeline/ingest-business.js';
import { parseFlexibleAmount } from '../pipeline/parse.js';

describe('Indian Financial Standards & Localization Tests', () => {
  describe('Indian Numbering & Rupee Formatting', () => {
    it('formats numbers with Indian grouping commas (Lakhs and Crores)', () => {
      // Under 1 Lakh
      expect(formatMoneyMinor(5000000, { prefix: '₹' })).toBe('₹50,000');
      // Exactly 1 Lakh (1,00,000)
      expect(formatMoneyMinor(10000000, { prefix: '₹' })).toBe('₹1,00,000');
      // 10 Lakhs (10,00,000)
      expect(formatMoneyMinor(100000000, { prefix: '₹' })).toBe('₹10,00,000');
      // 1 Crore (1,00,00,000)
      expect(formatMoneyMinor(1000000000, { prefix: '₹' })).toBe('₹1,00,00,000');
      // Complex multi-crore with paise
      expect(formatMoneyMinor(1234567850, { prefix: '₹', showCents: true })).toBe('₹1,23,45,678.50');
    });

    it('formats compact Indian denominations (Lakhs and Crores)', () => {
      expect(formatIndianMoneyMinor(1500000000, { compact: true })).toBe('₹1.5 Cr');
      expect(formatIndianMoneyMinor(45000000, { compact: true })).toBe('₹4.5 L');
      expect(formatIndianMoneyMinor(5000000, { compact: true })).toBe('₹50 K');
    });
  });

  describe('Indian Currency & Suffix Amount Parsing', () => {
    it('parses ₹ symbol, Rs., and INR currency hints', () => {
      expect(parseFlexibleAmount('₹1,50,000')?.value).toBe(150000);
      expect(parseFlexibleAmount('₹1,50,000')?.currencyHint).toBe('INR');

      expect(parseFlexibleAmount('Rs. 45,000.50')?.value).toBe(45000.5);
      expect(parseFlexibleAmount('Rs. 45,000.50')?.currencyHint).toBe('INR');

      expect(parseFlexibleAmount('INR 75,000')?.currencyHint).toBe('INR');
    });

    it('parses Lakhs and Crores suffixes', () => {
      // 1.5 Lakh = 150,000
      expect(parseFlexibleAmount('1.5L')?.value).toBe(150000);
      expect(parseFlexibleAmount('₹2.5 Lakh')?.value).toBe(250000);
      expect(parseFlexibleAmount('10 Lacs')?.value).toBe(1000000);

      // 2 Crore = 20,000,000
      expect(parseFlexibleAmount('2Cr')?.value).toBe(20000000);
      expect(parseFlexibleAmount('₹1.25 Crore')?.value).toBe(12500000);
    });

    it('adapts dollar input to Indian Rupee standards as requested', () => {
      expect(parseFlexibleAmount('$10,000')?.currencyHint).toBe('INR');
      expect(parseFlexibleAmount('10000 USD')?.currencyHint).toBe('INR');
    });
  });

  describe('Universal Ingestion Adapts to Indian Standards', () => {
    it('ingests Indian ledger with DD/MM/YYYY dates and defaults to INR ₹', () => {
      const csv = `Date,Description,Amount
15/04/2025,Tata Consultancy Services Enterprise ARR,1250000.00
20/05/2025,AWS Cloud Hosting Mumbai, -45000.00
10/06/2025,Bangalore Office Rent, -85000.00
15/08/2025,Reliance Digital Hardware Equipment, -120000.00`;

      const bundle = ingestFilesDeterministically([
        {
          name: 'india_tech_fy2025.csv',
          mimeType: 'text/csv',
          content: csv,
        },
      ]);

      expect(bundle.plan.business_meta?.currency_code).toBe('INR');
      expect(bundle.plan.business_meta?.currency_symbol).toBe('₹');
      expect(bundle.transactions.length).toBe(4);
      expect(bundle.transactions[0]?.currency).toBe('INR');
      expect(bundle.transactions[0]?.date).toBe('2025-04-15');
      expect(bundle.transactions[3]?.date).toBe('2025-08-15');
    });
  });
});
