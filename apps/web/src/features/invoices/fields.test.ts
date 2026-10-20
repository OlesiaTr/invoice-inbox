import { describe, expect, it } from 'vitest';
import { coerceFieldValue, fieldType, INVOICE_FIELDS } from './fields';

describe('invoice field descriptor', () => {
  it('covers every field the detail form offers, with no duplicates', () => {
    const keys = INVOICE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // The whole point of this module: the detail form and the assistant's confirmation card
  // used to each decide which fields were numeric, and could disagree.
  it('agrees on which fields are numeric', () => {
    expect(fieldType('total')).toBe('number');
    expect(fieldType('subtotal')).toBe('number');
    expect(fieldType('tax')).toBe('number');
    expect(fieldType('vendorName')).toBe('text');
    expect(fieldType('issueDate')).toBe('date');
  });

  it('parses numeric fields and leaves text fields alone', () => {
    expect(coerceFieldValue('total', '120.50')).toBe(120.5);
    expect(coerceFieldValue('total', 120.5)).toBe(120.5);
    expect(coerceFieldValue('vendorName', '  Acme  ')).toBe('Acme');
    expect(coerceFieldValue('issueDate', '2026-09-01')).toBe('2026-09-01');
  });

  it('turns blanks and unparseable numbers into null rather than NaN', () => {
    expect(coerceFieldValue('total', '')).toBeNull();
    expect(coerceFieldValue('total', 'abc')).toBeNull();
    expect(coerceFieldValue('vendorName', '   ')).toBeNull();
    expect(coerceFieldValue('total', null)).toBeNull();
  });
});
